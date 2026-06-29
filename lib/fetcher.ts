/**
 * Fetcher — orchestrates adapters, upserts to DB, and handles deduplication.
 *
 * Deduplication priority:
 *   1. DOI (authoritative)
 *   2. arXiv ID
 *   3. Normalized title similarity (simple lower-case + whitespace collapse)
 *
 * When a duplicate is found, we merge the incoming source link into the
 * existing Paper record (upsert PaperSource) rather than creating a new Paper.
 */

import { prisma } from "./prisma";
import { summarizePaper } from "./summarizer";
import type { FetchOptions, NormalizedPaper, SourceAdapter } from "./adapters/types";

// ---- Helpers ----------------------------------------------------------------

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Find an existing paper by DOI → arXivId → normalized title.
 * Returns the paper id if found, undefined otherwise.
 */
async function findExistingPaper(
  p: NormalizedPaper
): Promise<string | undefined> {
  if (p.doi) {
    const found = await prisma.paper.findUnique({ where: { doi: p.doi } });
    if (found) return found.id;
  }

  if (p.arxivId) {
    const found = await prisma.paper.findUnique({ where: { arxivId: p.arxivId } });
    if (found) return found.id;
  }

  // Title-based fuzzy match (simple normalization — good enough for MVP)
  const normalized = normalizeTitle(p.title);
  // Fetch recent papers with similar title prefix (first 50 chars)
  const prefix = normalized.slice(0, 50);
  const candidates = await prisma.paper.findMany({
    where: { title: { contains: prefix.slice(0, 30) } },
    select: { id: true, title: true },
  });
  for (const c of candidates) {
    if (normalizeTitle(c.title) === normalized) return c.id;
  }

  return undefined;
}

// ---- Main upsert logic ------------------------------------------------------

async function upsertPaper(p: NormalizedPaper): Promise<"created" | "updated"> {
  const existingId = await findExistingPaper(p);

  const sourceData = {
    source: p.source,
    sourceUrl: p.sourceUrl,
    pdfUrl: p.pdfUrl ?? null,
  };

  if (existingId) {
    // Merge tags: union of existing + incoming (preserves org/topic tags from all sources)
    const existing = await prisma.paper.findUnique({
      where: { id: existingId },
      select: { tags: true, citationCount: true },
    });
    const existingTags = JSON.parse(existing?.tags ?? "[]") as string[];
    const mergedTags = [...new Set([...existingTags, ...p.tags])];

    // Only update citationCount if incoming is higher (or existing is null)
    const shouldUpdateCitations =
      p.citationCount !== undefined &&
      (existing?.citationCount === null ||
        existing?.citationCount === undefined ||
        p.citationCount > (existing.citationCount ?? 0));

    await prisma.paper.update({
      where: { id: existingId },
      data: {
        tags: JSON.stringify(mergedTags),
        ...(shouldUpdateCitations ? { citationCount: p.citationCount } : {}),
        sources: {
          upsert: {
            where: { paperId_source: { paperId: existingId, source: p.source } },
            create: sourceData,
            update: sourceData,
          },
        },
      },
    });
    return "updated";
  } else {
    // Generate AI summary for new papers that have an abstract
    const summary =
      p.abstract ? await summarizePaper(p.title, p.abstract) : null;

    // Create new paper with its first source link
    await prisma.paper.create({
      data: {
        title: p.title,
        authors: JSON.stringify(p.authors),
        abstract: p.abstract ?? null,
        publishedDate: p.publishedDate ?? null,
        doi: p.doi ?? null,
        arxivId: p.arxivId ?? null,
        citationCount: p.citationCount ?? null,
        categories: JSON.stringify(p.categories),
        tags: JSON.stringify(p.tags),
        summary,
        sources: { create: sourceData },
      },
    });
    return "created";
  }
}

// ---- Public API -------------------------------------------------------------

export interface FetchResult {
  source: string;
  fetched: number;
  created: number;
  updated: number;
  errors: number;
  skipped: number;
}

export function twoWeeksAgo(): Date {
  return new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
}

/**
 * Prune papers older than `olderThanDays` days.
 * Only removes papers that have a publishedDate set AND it is before the cutoff.
 * Papers with no publishedDate are left untouched.
 * Returns the number of papers deleted.
 */
export async function prunePapers(olderThanDays = 14): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const { count } = await prisma.paper.deleteMany({
    where: {
      publishedDate: { lt: cutoff },
    },
  });
  return count;
}

export async function runAdapter(
  adapter: SourceAdapter,
  options?: FetchOptions
): Promise<FetchResult> {
  const result: FetchResult = {
    source: adapter.name,
    fetched: 0,
    created: 0,
    updated: 0,
    errors: 0,
    skipped: 0,
  };

  if (!adapter.enabled) {
    console.log(`[${adapter.name}] disabled — skipping`);
    return result;
  }

  console.log(`[${adapter.name}] Starting fetch…`);

  let papers: NormalizedPaper[];
  try {
    papers = await adapter.fetch(options);
  } catch (err) {
    console.error(`[${adapter.name}] Fetch failed:`, err);
    result.errors++;
    return result;
  }

  result.fetched = papers.length;
  console.log(`[${adapter.name}] Fetched ${papers.length} papers; upserting…`);

  for (const paper of papers) {
    try {
      const status = await upsertPaper(paper);
      if (status === "created") result.created++;
      else result.updated++;
    } catch (err) {
      console.error(`[${adapter.name}] Upsert error for "${paper.title}":`, err);
      result.errors++;
    }
  }

  console.log(
    `[${adapter.name}] Done: ${result.created} created, ${result.updated} updated, ${result.errors} errors`
  );
  return result;
}

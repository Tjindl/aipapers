/**
 * arXiv Adapter
 *
 * API:  https://arxiv.org/help/api/user-manual
 * Base: https://export.arxiv.org/api/query
 * Auth: None required
 * Rate: ~3 seconds between requests (arXiv TOS requirement)
 * Terms: https://arxiv.org/help/api/tou
 *
 * Returns Atom XML; parsed with fast-xml-parser.
 */

import { XMLParser } from "fast-xml-parser";
import { normalizeTags } from "../tagger";
import type { FetchOptions, NormalizedPaper, SourceAdapter } from "./types";

const BASE_URL = "https://export.arxiv.org/api/query";
const DEFAULT_CATEGORIES = [
  "cs.AI",
  "cs.LG",
  "cs.CL",
  "cs.CV",
  "cs.NE",
  "stat.ML",
];
const REQUEST_DELAY_MS = 3500; // arXiv asks for polite access

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => ["entry", "author", "category", "link"].includes(name),
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractArxivId(id: string): string {
  // id looks like "http://arxiv.org/abs/2301.12345v2"
  const match = id.match(/abs\/([^v]+)/);
  return match ? match[1] : id;
}

function parseEntry(entry: Record<string, unknown>): NormalizedPaper | null {
  try {
    const id = (entry["id"] as string) ?? "";
    const arxivId = extractArxivId(id);

    const title = ((entry["title"] as string) ?? "").replace(/\s+/g, " ").trim();
    const abstract = ((entry["summary"] as string) ?? "").replace(/\s+/g, " ").trim();

    const rawAuthors = entry["author"] as Array<Record<string, string>> | undefined;
    const authors = (rawAuthors ?? []).map((a) => a["name"] ?? "").filter(Boolean);

    const published = entry["published"] as string | undefined;
    const publishedDate = published ? new Date(published) : undefined;

    const rawCategories = entry["category"] as Array<Record<string, string>> | undefined;
    const categories = (rawCategories ?? [])
      .map((c) => c["@_term"] ?? "")
      .filter(Boolean);

    const links = (entry["link"] as Array<Record<string, string>> | undefined) ?? [];
    const pdfLink = links.find((l) => l["@_title"] === "pdf");
    const pdfUrl = pdfLink ? pdfLink["@_href"] : undefined;

    const doi = (entry["arxiv:doi"] as string | undefined) ?? undefined;

    // Generate precise human-readable tags via tagger
    const tags = normalizeTags({ title, abstract, rawCategories: categories });

    return {
      title,
      authors,
      abstract,
      publishedDate,
      doi,
      arxivId,
      categories,
      tags,
      source: "arxiv",
      sourceUrl: `https://arxiv.org/abs/${arxivId}`,
      pdfUrl: pdfUrl ?? `https://arxiv.org/pdf/${arxivId}`,
    };
  } catch {
    return null;
  }
}

export class ArxivAdapter implements SourceAdapter {
  readonly name = "arxiv";
  readonly label = "arXiv";
  readonly enabled = true;

  async fetch(options: FetchOptions = {}): Promise<NormalizedPaper[]> {
    const {
      maxResults = 200,
      since,
      query,
      categories = DEFAULT_CATEGORIES,
    } = options;

    const papers: NormalizedPaper[] = [];
    const batchSize = Math.min(100, maxResults);

    // Build search query: combine category filter + optional text query
    const categoryQuery = categories.map((c) => `cat:${c}`).join(" OR ");
    const searchQuery = query
      ? `(${categoryQuery}) AND all:${encodeURIComponent(query)}`
      : `(${categoryQuery})`;

    let start = 0;
    while (papers.length < maxResults) {
      const remaining = maxResults - papers.length;
      const count = Math.min(batchSize, remaining);

      const url = new URL(BASE_URL);
      url.searchParams.set("search_query", searchQuery);
      url.searchParams.set("start", String(start));
      url.searchParams.set("max_results", String(count));
      url.searchParams.set("sortBy", "submittedDate");
      url.searchParams.set("sortOrder", "descending");

      const res = await fetch(url.toString());
      if (!res.ok) {
        console.error(`arXiv API error: ${res.status} ${res.statusText}`);
        break;
      }

      const xml = await res.text();
      const parsed = parser.parse(xml);
      const feed = parsed?.feed;
      if (!feed) break;

      const entries = (feed.entry as Array<Record<string, unknown>> | undefined) ?? [];
      if (entries.length === 0) break;

      let hitCutoff = false;
      for (const entry of entries) {
        const paper = parseEntry(entry);
        if (!paper) continue;
        // Papers are sorted newest-first; once we see one older than `since` we're done
        if (since && paper.publishedDate && paper.publishedDate < since) {
          hitCutoff = true;
          break;
        }
        papers.push(paper);
      }

      start += entries.length;
      if (entries.length < count || hitCutoff) break; // no more results or hit cutoff

      // Respect arXiv rate limit between paginated requests
      await sleep(REQUEST_DELAY_MS);
    }

    return papers;
  }
}

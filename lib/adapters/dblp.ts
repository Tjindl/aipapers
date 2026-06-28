/**
 * DBLP Adapter
 *
 * API:  https://dblp.org/faq/How+to+use+the+dblp+search+API.html
 * Base: https://dblp.org/search
 * Auth: None required
 * Rate: ~1 req/s (be polite; no official limit stated)
 * Terms: https://dblp.org/faq/Am+I+allowed+to+copy+data+from+dblp.html
 *
 * DBLP is a bibliographic metadata source. It's strong for conference papers
 * and author metadata but often lacks abstracts.
 */

import type { FetchOptions, NormalizedPaper, SourceAdapter } from "./types";

const BASE_URL = "https://dblp.org/search/publ/api";

const AI_QUERIES = [
  "neural network deep learning",
  "language model transformer",
  "reinforcement learning",
  "computer vision",
];

interface DBLPHit {
  info?: {
    title?: string;
    authors?: { author?: DBLPAuthor | DBLPAuthor[] };
    year?: string;
    doi?: string;
    url?: string;
    ee?: string | string[];
    venue?: string;
    type?: string;
  };
}

interface DBLPAuthor {
  text?: string;
  "@pid"?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAuthors(raw: DBLPHit["info"]): string[] {
  const a = raw?.authors?.author;
  if (!a) return [];
  const arr = Array.isArray(a) ? a : [a];
  return arr.map((x) => x.text ?? "").filter(Boolean);
}

function parseHit(hit: DBLPHit): NormalizedPaper | null {
  const info = hit.info;
  if (!info?.title) return null;

  const title = info.title.trim();
  const authors = normalizeAuthors(info);
  const year = info.year ? parseInt(info.year, 10) : undefined;
  const publishedDate = year ? new Date(`${year}-01-01`) : undefined;
  const doi = info.doi;

  const ees = info.ee
    ? Array.isArray(info.ee)
      ? info.ee
      : [info.ee]
    : [];
  const pdfUrl = ees.find((e) => e.endsWith(".pdf"));

  const categories = info.venue ? [info.venue] : [];

  return {
    title,
    authors,
    publishedDate,
    doi,
    categories,
    tags: categories,
    source: "dblp",
    sourceUrl: info.url ?? info.ee?.[0] ?? `https://dblp.org`,
    pdfUrl,
  };
}

export class DBLPAdapter implements SourceAdapter {
  readonly name = "dblp";
  readonly label = "DBLP";
  readonly enabled = true;

  async fetch(options: FetchOptions = {}): Promise<NormalizedPaper[]> {
    const { maxResults = 100, query } = options;

    const queries = query ? [query] : AI_QUERIES;
    const papers: NormalizedPaper[] = [];
    const seen = new Set<string>();
    const perQuery = Math.ceil(maxResults / queries.length);

    for (const q of queries) {
      if (papers.length >= maxResults) break;

      let first = 0;
      const f = Math.min(100, perQuery);
      let fetched = 0;

      while (fetched < perQuery) {
        const url = new URL(BASE_URL);
        url.searchParams.set("q", q);
        url.searchParams.set("format", "json");
        url.searchParams.set("h", String(f));
        url.searchParams.set("f", String(first));

        try {
          const res = await fetch(url.toString());
          if (!res.ok) {
            console.error(`DBLP error: ${res.status}`);
            break;
          }

          const data = (await res.json()) as {
            result?: {
              hits?: {
                hit?: DBLPHit[];
                "@total"?: string;
                "@sent"?: string;
              };
            };
          };
          const hits = data.result?.hits?.hit ?? [];
          if (hits.length === 0) break;

          for (const hit of hits) {
            const paper = parseHit(hit);
            if (!paper) continue;
            const key = paper.doi ?? paper.title.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            papers.push(paper);
          }

          fetched += hits.length;
          first += hits.length;
          if (hits.length < f) break;
          await sleep(1000);
        } catch (err) {
          console.error("DBLP fetch error:", err);
          break;
        }
      }

      await sleep(1000);
    }

    return papers.slice(0, maxResults);
  }
}

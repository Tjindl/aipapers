/**
 * CORE Adapter
 *
 * API:  https://api.core.ac.uk/docs/v3
 * Base: https://api.core.ac.uk/v3
 * Auth: API key required (free registration at https://core.ac.uk/services/api)
 * Rate: 10 requests/minute on free tier
 * Terms: https://core.ac.uk/terms
 *
 * CORE is a large open-access aggregator; well suited for broad AI paper discovery.
 * If no CORE_API_KEY is set, this adapter is disabled.
 */

import type { FetchOptions, NormalizedPaper, SourceAdapter } from "./types";

const BASE_URL = "https://api.core.ac.uk/v3";

const AI_QUERIES = [
  "artificial intelligence machine learning",
  "deep learning neural networks",
  "natural language processing transformers",
  "computer vision object detection",
];

interface CoreWork {
  id?: number;
  title?: string;
  authors?: Array<{ name?: string }>;
  abstract?: string;
  publishedDate?: string;
  yearPublished?: number;
  doi?: string;
  arxivId?: string;
  downloadUrl?: string;
  sourceFulltextUrls?: string[];
  subjects?: string[];
  fieldOfStudy?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseWork(work: CoreWork): NormalizedPaper | null {
  if (!work.title) return null;

  const authors = (work.authors ?? [])
    .map((a) => a.name ?? "")
    .filter(Boolean);

  let publishedDate: Date | undefined;
  if (work.publishedDate) {
    publishedDate = new Date(work.publishedDate);
  } else if (work.yearPublished) {
    publishedDate = new Date(`${work.yearPublished}-01-01`);
  }

  const categories: string[] = [];
  if (work.fieldOfStudy) categories.push(work.fieldOfStudy);
  if (work.subjects) categories.push(...work.subjects);

  return {
    title: work.title.trim(),
    authors,
    abstract: work.abstract?.trim(),
    publishedDate,
    doi: work.doi,
    arxivId: work.arxivId,
    categories,
    tags: categories,
    source: "core",
    sourceUrl: `https://core.ac.uk/works/${work.id}`,
    pdfUrl: work.downloadUrl ?? work.sourceFulltextUrls?.[0],
  };
}

export class CoreAdapter implements SourceAdapter {
  readonly name = "core";
  readonly label = "CORE";
  readonly enabled: boolean;

  private apiKey: string;

  constructor() {
    this.apiKey = process.env.CORE_API_KEY ?? "";
    this.enabled = Boolean(this.apiKey);
    if (!this.enabled) {
      console.warn("CORE adapter disabled: CORE_API_KEY not set");
    }
  }

  async fetch(options: FetchOptions = {}): Promise<NormalizedPaper[]> {
    if (!this.enabled) return [];

    const { maxResults = 100, query } = options;
    const queries = query ? [query] : AI_QUERIES;
    const papers: NormalizedPaper[] = [];
    const seen = new Set<string>();
    const perQuery = Math.ceil(maxResults / queries.length);

    for (const q of queries) {
      if (papers.length >= maxResults) break;

      const url = new URL(`${BASE_URL}/search/works`);
      url.searchParams.set("q", q);
      url.searchParams.set("limit", String(Math.min(100, perQuery)));
      url.searchParams.set("sort", "publishedDate:desc");

      try {
        const res = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        });

        if (res.status === 401) {
          console.error("CORE: invalid API key");
          break;
        }
        if (res.status === 429) {
          console.warn("CORE: rate limited, waiting 65s");
          await sleep(65000);
          continue;
        }
        if (!res.ok) {
          console.error(`CORE error: ${res.status}`);
          break;
        }

        const data = (await res.json()) as { results?: CoreWork[] };
        const results = data.results ?? [];

        for (const work of results) {
          const paper = parseWork(work);
          if (!paper) continue;
          const key = paper.doi ?? paper.arxivId ?? paper.title.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          papers.push(paper);
        }
      } catch (err) {
        console.error("CORE fetch error:", err);
      }

      // CORE free tier: 10 req/min = 6s between requests
      await sleep(6500);
    }

    return papers.slice(0, maxResults);
  }
}

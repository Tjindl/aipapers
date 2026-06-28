/**
 * Semantic Scholar Adapter
 *
 * API:  https://api.semanticscholar.org/api-docs/graph
 * Base: https://api.semanticscholar.org/graph/v1
 * Auth: Optional API key raises rate limits (100 req/5min free, 1 req/s with key)
 * Rate: 100 requests per 5 minutes without key; 1 req/s with key
 * Terms: https://www.semanticscholar.org/product/api#api-license
 */

import { normalizeTags } from "../tagger";
import type { FetchOptions, NormalizedPaper, SourceAdapter } from "./types";

const BASE_URL = "https://api.semanticscholar.org/graph/v1";
const FIELDS =
  "paperId,title,authors,abstract,year,citationCount,externalIds,openAccessPdf,publicationDate,fieldsOfStudy,s2FieldsOfStudy";

const DEFAULT_QUERIES = [
  "artificial intelligence",
  "machine learning",
  "deep learning",
  "natural language processing",
  "computer vision",
];

interface S2Author {
  authorId: string;
  name: string;
}

interface S2Paper {
  paperId: string;
  title: string;
  authors: S2Author[];
  abstract?: string;
  year?: number;
  citationCount?: number;
  publicationDate?: string;
  externalIds?: { DOI?: string; ArXiv?: string };
  openAccessPdf?: { url: string };
  fieldsOfStudy?: string[];
  s2FieldsOfStudy?: Array<{ category: string; source: string }>;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SemanticScholarAdapter implements SourceAdapter {
  readonly name = "semanticscholar";
  readonly label = "Semantic Scholar";
  readonly enabled = true;

  private apiKey?: string;
  private delayMs: number;

  constructor() {
    this.apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY || undefined;
    // Without key: ~3s between requests to stay under 100/5min; with key: 1.1s
    this.delayMs = this.apiKey ? 1100 : 3000;
  }

  private headers(): HeadersInit {
    if (this.apiKey) return { "x-api-key": this.apiKey };
    return {};
  }

  private parseS2Paper(p: S2Paper): NormalizedPaper {
    const doi = p.externalIds?.DOI;
    const arxivId = p.externalIds?.ArXiv;

    const categories: string[] = [];
    if (p.fieldsOfStudy) categories.push(...p.fieldsOfStudy);
    if (p.s2FieldsOfStudy) {
      for (const f of p.s2FieldsOfStudy) {
        if (!categories.includes(f.category)) categories.push(f.category);
      }
    }

    const title = p.title ?? "";
    const abstract = p.abstract;
    const tags = normalizeTags({ title, abstract, rawCategories: categories });

    return {
      title,
      authors: (p.authors ?? []).map((a) => a.name),
      abstract,
      publishedDate: p.publicationDate
        ? new Date(p.publicationDate)
        : p.year
        ? new Date(`${p.year}-01-01`)
        : undefined,
      doi,
      arxivId,
      citationCount: p.citationCount,
      categories,
      tags,
      source: "semanticscholar",
      sourceUrl: `https://www.semanticscholar.org/paper/${p.paperId}`,
      pdfUrl: p.openAccessPdf?.url,
    };
  }

  async fetch(options: FetchOptions = {}): Promise<NormalizedPaper[]> {
    const { maxResults = 100, query, since } = options;

    const queries = query ? [query] : DEFAULT_QUERIES;
    const papers: NormalizedPaper[] = [];
    const seen = new Set<string>();
    const perQuery = Math.ceil(maxResults / queries.length);

    // Build date filter string: "YYYY-MM-DD:" means "on or after this date"
    let dateFilter: string | undefined;
    if (since) {
      const iso = since.toISOString().slice(0, 10); // YYYY-MM-DD
      dateFilter = `${iso}:`;
    }

    for (const q of queries) {
      if (papers.length >= maxResults) break;

      let offset = 0;
      const limit = Math.min(100, perQuery);

      while (papers.length < maxResults) {
        const url = new URL(`${BASE_URL}/paper/search`);
        url.searchParams.set("query", q);
        url.searchParams.set("fields", FIELDS);
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("offset", String(offset));
        if (dateFilter) url.searchParams.set("publicationDateOrYear", dateFilter);

        const res = await fetch(url.toString(), { headers: this.headers() });

        if (res.status === 429) {
          console.warn("Semantic Scholar rate limited; waiting 60s");
          await sleep(60000);
          continue;
        }
        if (!res.ok) {
          console.error(`Semantic Scholar error: ${res.status}`);
          break;
        }

        const data = (await res.json()) as {
          data?: S2Paper[];
          next?: number;
        };
        const items = data.data ?? [];
        if (items.length === 0) break;

        for (const item of items) {
          if (!item.title) continue;
          const key = item.paperId;
          if (seen.has(key)) continue;
          seen.add(key);
          papers.push(this.parseS2Paper(item));
        }

        if (!data.next) break;
        offset = data.next;
        await sleep(this.delayMs);
      }

      await sleep(this.delayMs);
    }

    return papers.slice(0, maxResults);
  }
}

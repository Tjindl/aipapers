/**
 * CrossRef Adapter
 *
 * API:  https://api.crossref.org/swagger-ui/index.html
 * Base: https://api.crossref.org
 * Auth: None required; Polite Pool with contact email in User-Agent increases limits
 * Rate: No hard limit in polite pool; be reasonable (~1 req/s)
 * Terms: https://www.crossref.org/services/metadata-retrieval/metadata-plus/
 *
 * Used primarily for DOI metadata enrichment and deduplication.
 * Can also search for AI/ML papers by querying specific journals/conferences.
 */

import type { FetchOptions, NormalizedPaper, SourceAdapter } from "./types";

const BASE_URL = "https://api.crossref.org";

// The Polite Pool: add your email to User-Agent for priority access
const CONTACT_EMAIL = process.env.CROSSREF_CONTACT_EMAIL || "contact@example.com";
const USER_AGENT = `Corpus/1.0 (${CONTACT_EMAIL})`;

// AI/ML filter terms for CrossRef
const SEARCH_QUERIES = [
  "artificial intelligence deep learning",
  "transformer neural network language model",
  "reinforcement learning policy gradient",
  "computer vision convolutional neural network",
];

interface CrossRefAuthor {
  given?: string;
  family?: string;
  name?: string;
}

interface CrossRefItem {
  DOI?: string;
  title?: string[];
  author?: CrossRefAuthor[];
  abstract?: string;
  published?: { "date-parts"?: number[][] };
  "published-print"?: { "date-parts"?: number[][] };
  "published-online"?: { "date-parts"?: number[][] };
  subject?: string[];
  link?: Array<{ URL: string; "content-type": string }>;
  URL?: string;
  "container-title"?: string[];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseDateParts(parts?: number[][]): Date | undefined {
  if (!parts || !parts[0]) return undefined;
  const [year, month = 1, day = 1] = parts[0];
  return new Date(year, month - 1, day);
}

function authorName(a: CrossRefAuthor): string {
  if (a.name) return a.name;
  return [a.given, a.family].filter(Boolean).join(" ");
}

function parseItem(item: CrossRefItem): NormalizedPaper | null {
  const title = item.title?.[0]?.trim();
  if (!title) return null;

  const doi = item.DOI;
  const authors = (item.author ?? []).map(authorName).filter(Boolean);

  const dateParts =
    item.published?.["date-parts"] ??
    item["published-online"]?.["date-parts"] ??
    item["published-print"]?.["date-parts"];
  const publishedDate = parseDateParts(dateParts);

  const categories = item.subject ?? [];
  const journal = item["container-title"]?.[0];
  if (journal) categories.push(journal);

  const pdfLink = (item.link ?? []).find(
    (l) =>
      l["content-type"] === "application/pdf" ||
      l["content-type"] === "unspecified"
  );

  return {
    title,
    authors,
    abstract: item.abstract?.replace(/<[^>]+>/g, "").trim(),
    publishedDate,
    doi,
    categories,
    tags: categories,
    source: "crossref",
    sourceUrl: item.URL ?? (doi ? `https://doi.org/${doi}` : ""),
    pdfUrl: pdfLink?.URL,
  };
}

export class CrossRefAdapter implements SourceAdapter {
  readonly name = "crossref";
  readonly label = "CrossRef";
  readonly enabled = true;

  async fetch(options: FetchOptions = {}): Promise<NormalizedPaper[]> {
    const { maxResults = 100, query } = options;

    const queries = query ? [query] : SEARCH_QUERIES;
    const papers: NormalizedPaper[] = [];
    const seen = new Set<string>();
    const perQuery = Math.ceil(maxResults / queries.length);

    for (const q of queries) {
      if (papers.length >= maxResults) break;

      const url = new URL(`${BASE_URL}/works`);
      url.searchParams.set("query", q);
      url.searchParams.set("rows", String(Math.min(100, perQuery)));
      url.searchParams.set("filter", "type:journal-article,has-abstract:true");
      url.searchParams.set("sort", "published");
      url.searchParams.set("order", "desc");
      url.searchParams.set("select", "DOI,title,author,abstract,published,published-print,published-online,subject,link,URL,container-title");

      try {
        const res = await fetch(url.toString(), {
          headers: { "User-Agent": USER_AGENT },
        });
        if (!res.ok) {
          console.error(`CrossRef error: ${res.status}`);
          break;
        }

        const data = (await res.json()) as {
          message?: { items?: CrossRefItem[] };
        };
        const items = data.message?.items ?? [];

        for (const item of items) {
          const paper = parseItem(item);
          if (!paper) continue;
          const key = paper.doi ?? paper.title.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          papers.push(paper);
        }
      } catch (err) {
        console.error("CrossRef fetch error:", err);
      }

      await sleep(1000);
    }

    return papers.slice(0, maxResults);
  }
}

/**
 * Organizations Adapter
 *
 * Searches arXiv for papers from specific AI research organizations using
 * the `all:` field (searches titles, abstracts, affiliations, and comments).
 *
 * API:  https://export.arxiv.org/api/query
 * Auth: None required
 * Rate: 3.5s between requests (arXiv TOS)
 *
 * Papers are tagged with the organization name so they can be filtered via
 * the "Organization" filter in the UI (tag=Anthropic, tag=OpenAI, etc.).
 * Deduplication (via arXiv ID) prevents duplicate DB records when the same
 * paper is fetched by both this adapter and the standard arXiv adapter.
 */

import { XMLParser } from "fast-xml-parser";
import { normalizeTags } from "../tagger";
import type { FetchOptions, NormalizedPaper, SourceAdapter } from "./types";

const BASE_URL = "https://export.arxiv.org/api/query";
const REQUEST_DELAY_MS = 3500;

const AI_CATS = "(cat:cs.AI OR cat:cs.LG OR cat:cs.CL OR cat:cs.CV OR cat:cs.NE OR cat:stat.ML OR cat:cs.RO OR cat:cs.HC)";

/**
 * Organizations to search for. The `searchTerm` is used in arXiv `all:` field.
 * Use the exact org name as it commonly appears in paper abstracts/affiliations.
 */
export const ORGS_TO_FETCH: Array<{ org: string; searchTerm: string }> = [
  { org: "Anthropic", searchTerm: "Anthropic" },
  { org: "OpenAI", searchTerm: "OpenAI" },
  { org: "Google DeepMind", searchTerm: "DeepMind" },
  { org: "Google Research", searchTerm: "Google Research" },
  { org: "Meta AI", searchTerm: "\"Meta AI\"" },
  { org: "Hugging Face", searchTerm: "\"Hugging Face\"" },
  { org: "Microsoft Research", searchTerm: "\"Microsoft Research\"" },
  { org: "NVIDIA Research", searchTerm: "\"NVIDIA Research\"" },
  { org: "Allen AI", searchTerm: "\"Allen Institute for AI\"" },
  { org: "Cohere", searchTerm: "Cohere" },
  { org: "Mistral AI", searchTerm: "\"Mistral AI\"" },
  { org: "Stability AI", searchTerm: "\"Stability AI\"" },
  { org: "EleutherAI", searchTerm: "EleutherAI" },
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => ["entry", "author", "category", "link"].includes(name),
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractArxivId(id: string): string {
  const match = id.match(/abs\/([^v]+)/);
  return match ? match[1] : id;
}

function parseEntry(
  entry: Record<string, unknown>,
  orgTag: string
): NormalizedPaper | null {
  try {
    const id = (entry["id"] as string) ?? "";
    const arxivId = extractArxivId(id);
    const title = ((entry["title"] as string) ?? "").replace(/\s+/g, " ").trim();
    const abstract = ((entry["summary"] as string) ?? "").replace(/\s+/g, " ").trim();
    if (!title) return null;

    const rawAuthors = entry["author"] as Array<Record<string, string>> | undefined;
    const authors = (rawAuthors ?? []).map((a) => a["name"] ?? "").filter(Boolean);

    const published = entry["published"] as string | undefined;
    const publishedDate = published ? new Date(published) : undefined;

    const rawCategories = entry["category"] as Array<Record<string, string>> | undefined;
    const rawCats = (rawCategories ?? []).map((c) => c["@_term"] ?? "").filter(Boolean);

    const links = (entry["link"] as Array<Record<string, string>> | undefined) ?? [];
    const pdfLink = links.find((l) => l["@_title"] === "pdf");
    const pdfUrl = pdfLink ? pdfLink["@_href"] : `https://arxiv.org/pdf/${arxivId}`;

    const doi = (entry["arxiv:doi"] as string | undefined) ?? undefined;

    // Generate precise tags via tagger + inject org tag
    const tags = normalizeTags({ title, abstract, rawCategories: rawCats });
    if (!tags.includes(orgTag)) tags.push(orgTag);

    return {
      title,
      authors,
      abstract,
      publishedDate,
      doi,
      arxivId,
      categories: rawCats,
      tags,
      source: "arxiv",
      sourceUrl: `https://arxiv.org/abs/${arxivId}`,
      pdfUrl,
    };
  } catch {
    return null;
  }
}

export class OrganizationsAdapter implements SourceAdapter {
  readonly name = "organizations";
  readonly label = "AI Organizations";
  readonly enabled = true;

  async fetch(options: FetchOptions = {}): Promise<NormalizedPaper[]> {
    const { maxResults = 200, since, query } = options;

    const papers: NormalizedPaper[] = [];
    const seen = new Set<string>();

    const orgsToRun = query
      ? ORGS_TO_FETCH.filter((o) =>
          o.org.toLowerCase().includes(query.toLowerCase())
        )
      : ORGS_TO_FETCH;

    const perOrg = Math.max(5, Math.floor(maxResults / orgsToRun.length));

    for (const { org, searchTerm } of orgsToRun) {
      if (papers.length >= maxResults) break;

      const searchQuery = `all:${searchTerm} AND ${AI_CATS}`;
      const count = Math.min(25, perOrg); // small batches per org to be polite

      const url = new URL(BASE_URL);
      url.searchParams.set("search_query", searchQuery);
      url.searchParams.set("start", "0");
      url.searchParams.set("max_results", String(count));
      url.searchParams.set("sortBy", "submittedDate");
      url.searchParams.set("sortOrder", "descending");

      try {
        const res = await fetch(url.toString());
        if (!res.ok) {
          console.warn(`[organizations] arXiv error ${res.status} for "${org}"`);
          await sleep(REQUEST_DELAY_MS);
          continue;
        }

        const xml = await res.text();
        const parsed = parser.parse(xml);
        const entries =
          (parsed?.feed?.entry as Array<Record<string, unknown>> | undefined) ?? [];

        for (const entry of entries) {
          const paper = parseEntry(entry, org);
          if (!paper) continue;
          if (since && paper.publishedDate && paper.publishedDate < since) continue;
          const key = paper.arxivId ?? paper.title.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          papers.push(paper);
        }
      } catch (err) {
        console.warn(`[organizations] fetch error for "${org}":`, err);
      }

      await sleep(REQUEST_DELAY_MS);
    }

    return papers.slice(0, maxResults);
  }
}

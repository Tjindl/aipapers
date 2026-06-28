import { ArxivAdapter } from "./arxiv";
import { SemanticScholarAdapter } from "./semanticscholar";
import { OpenReviewAdapter } from "./openreview";
import { CrossRefAdapter } from "./crossref";
import { CoreAdapter } from "./core";
import { DBLPAdapter } from "./dblp";
import { OrganizationsAdapter } from "./organizations";
import type { SourceAdapter } from "./types";

export type { SourceAdapter, NormalizedPaper, FetchOptions } from "./types";

/** Registry of all source adapters. Add new adapters here. */
export const adapters: SourceAdapter[] = [
  new ArxivAdapter(),
  new OrganizationsAdapter(),
  new SemanticScholarAdapter(),
  new OpenReviewAdapter(),
  new CrossRefAdapter(),
  new CoreAdapter(),
  new DBLPAdapter(),
];

export function getAdapter(name: string): SourceAdapter | undefined {
  return adapters.find((a) => a.name === name);
}

export function enabledAdapters(): SourceAdapter[] {
  return adapters.filter((a) => a.enabled);
}

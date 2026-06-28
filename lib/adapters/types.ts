export interface NormalizedPaper {
  title: string;
  authors: string[];
  abstract?: string;
  publishedDate?: Date;
  doi?: string;
  arxivId?: string;
  citationCount?: number;
  categories: string[];
  tags: string[];
  source: string;
  sourceUrl: string;
  pdfUrl?: string;
}

export interface FetchOptions {
  /** Max number of papers to fetch per run */
  maxResults?: number;
  /** Only fetch papers published after this date */
  since?: Date;
  /** Free-text query to narrow results */
  query?: string;
  /** Source-specific categories/topics */
  categories?: string[];
}

export interface SourceAdapter {
  /** Unique identifier for this source (e.g. "arxiv") */
  readonly name: string;
  /** Human-readable label */
  readonly label: string;
  /** Whether this adapter is currently enabled */
  readonly enabled: boolean;
  /** Fetch papers and return them in the normalized schema */
  fetch(options?: FetchOptions): Promise<NormalizedPaper[]>;
}

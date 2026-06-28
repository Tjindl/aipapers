"use client";

const SOURCE_LABELS: Record<string, string> = {
  arxiv: "arXiv",
  semanticscholar: "Semantic Scholar",
  openreview: "OpenReview",
  crossref: "CrossRef",
  core: "CORE",
  dblp: "DBLP",
  organizations: "arXiv",
};

export function SourceBadge({ source }: { source: string }) {
  const label = SOURCE_LABELS[source] ?? source;
  return (
    <span
      className="section-label"
      style={{ color: "var(--ink-3)", letterSpacing: "0.06em" }}
    >
      {label}
    </span>
  );
}

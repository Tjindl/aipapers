"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export interface PaperSource {
  id: string;
  source: string;
  sourceUrl: string;
  pdfUrl?: string | null;
}

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract?: string | null;
  publishedDate?: string | null;
  categories: string[];
  tags: string[];
  citationCount?: number | null;
  sources: PaperSource[];
}

const SOURCE_LABELS: Record<string, string> = {
  arxiv: "arXiv",
  semanticscholar: "Semantic Scholar",
  openreview: "OpenReview",
  crossref: "CrossRef",
  core: "CORE",
  dblp: "DBLP",
  organizations: "arXiv",
};

const ORG_BADGES: Record<string, { short: string; color: string }> = {
  "Anthropic":           { short: "ANT",  color: "#e07040" },
  "OpenAI":              { short: "OAI",  color: "#10a37f" },
  "Google DeepMind":     { short: "GDM",  color: "#4285f4" },
  "Google Research":     { short: "GGL",  color: "#ea4335" },
  "Meta AI":             { short: "META", color: "#0866ff" },
  "Microsoft Research":  { short: "MSFT", color: "#00a4ef" },
  "Hugging Face":        { short: "HF",   color: "#f5a623" },
  "NVIDIA Research":     { short: "NV",   color: "#76b900" },
  "Apple ML":            { short: "AAPL", color: "#888888" },
  "Amazon Science":      { short: "AWS",  color: "#ff9900" },
  "Cohere":              { short: "COH",  color: "#39594d" },
  "Mistral AI":          { short: "MST",  color: "#f54e42" },
  "Stability AI":        { short: "STAB", color: "#7c3aed" },
  "EleutherAI":          { short: "ELEU", color: "#3b82f6" },
  "Allen AI":            { short: "AI2",  color: "#06b6d4" },
  "Salesforce Research": { short: "SFDC", color: "#00a1e0" },
  "IBM Research":        { short: "IBM",  color: "#054ada" },
  "Samsung Research":    { short: "SAM",  color: "#1428a0" },
  "Tencent AI":          { short: "TX",   color: "#07c160" },
  "Baidu Research":      { short: "BDU",  color: "#2932e1" },
};

function OrgBadge({ tag }: { tag: string }) {
  const badge = ORG_BADGES[tag];
  if (!badge) return null;
  return (
    <span
      title={tag}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: "0.55rem",
        fontWeight: 800,
        letterSpacing: "0.07em",
        padding: "0.22em 0.55em",
        borderRadius: "3px",
        color: badge.color,
        background: `${badge.color}18`,
        border: `1px solid ${badge.color}40`,
        whiteSpace: "nowrap",
        fontFamily: "var(--font-geist-mono, monospace)",
      }}
    >
      {badge.short}
    </span>
  );
}

function firstOrgTag(tags: string[]): string | null {
  return tags.find((t) => t in ORG_BADGES) ?? null;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCitations(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

function formatAuthors(authors: string[], max: number): string {
  if (authors.length === 0) return "";
  if (authors.length <= max) return authors.join(", ");
  return `${authors.slice(0, max).join(", ")} +${authors.length - max} more`;
}

const BOOKMARK_KEY = "corpus_bookmarks";

function getBookmarks(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

function toggleBookmark(id: string): boolean {
  const bm = getBookmarks();
  bm.has(id) ? bm.delete(id) : bm.add(id);
  localStorage.setItem(BOOKMARK_KEY, JSON.stringify([...bm]));
  return bm.has(id);
}

function primaryLabel(tags: string[], categories: string[]): string {
  const topicTag = tags.find(
    (t) => !t.match(/^[a-z]{1,5}\.[A-Z]{2}/) && !["cs", "stat", "eess", "q-bio"].includes(t)
  );
  if (topicTag) return topicTag;
  return categories[0] ?? tags[0] ?? "";
}

function extraLabels(tags: string[], primary: string): string[] {
  return tags
    .filter(
      (t) =>
        t !== primary &&
        !t.match(/^[a-z]{1,5}\.[A-Z]{2}/) &&
        !["cs", "stat", "eess", "q-bio"].includes(t)
    )
    .slice(0, 3);
}

function BookmarkBtn({ paperId }: { paperId: string }) {
  const [bookmarked, setBookmarked] = useState(false);
  useEffect(() => { setBookmarked(getBookmarks().has(paperId)); }, [paperId]);
  return (
    <button
      onClick={(e) => { e.preventDefault(); setBookmarked(toggleBookmark(paperId)); }}
      aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
      style={{ color: bookmarked ? "#d97706" : "var(--ink-3)" }}
      className="transition-all hover:scale-110 shrink-0"
    >
      <svg className="w-4 h-4" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    </button>
  );
}

export function PaperCard({ paper, featured = false }: { paper: Paper; featured?: boolean }) {
  const label = primaryLabel(paper.tags ?? [], paper.categories);
  const extra = extraLabels(paper.tags ?? [], label);
  const orgTag = firstOrgTag(paper.tags ?? []);
  const primarySource = paper.sources[0];
  const sourceLabel = SOURCE_LABELS[primarySource?.source ?? ""] ?? primarySource?.source ?? "";
  const pdfUrl = paper.sources.find((s) => s.pdfUrl)?.pdfUrl;
  const date = formatDate(paper.publishedDate);
  const hasCitations = typeof paper.citationCount === "number" && paper.citationCount > 0;

  /* ── Featured / lead story ─────────────────────────── */
  if (featured) {
    return (
      <article
        className="paper-hover py-8 border-b"
        style={{ borderColor: "var(--rule)" }}
      >
        {/* Labels row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            {label && <span className="tag-pill">{label}</span>}
            {extra.map((t) => (
              <span key={t} className="tag-pill tag-pill-muted">{t}</span>
            ))}
            {orgTag && <OrgBadge tag={orgTag} />}
          </div>
          <BookmarkBtn paperId={paper.id} />
        </div>

        {/* Headline */}
        <Link href={`/papers/${paper.id}`}>
          <h2
            className="font-serif leading-[1.12] mb-5 hover:opacity-75 transition-opacity"
            style={{
              fontSize: "clamp(1.9rem, 3.8vw, 3rem)",
              color: "var(--ink)",
              letterSpacing: "-0.01em",
            }}
          >
            {paper.title}
          </h2>
        </Link>

        {/* Thin rule */}
        <div style={{ height: "1px", background: "var(--rule)", marginBottom: "1.1rem" }} />

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-4">
          {paper.authors.length > 0 && (
            <span className="byline" style={{ color: "var(--ink-2)" }}>
              {formatAuthors(paper.authors, 4)}
            </span>
          )}
          {(sourceLabel || date || hasCitations) && paper.authors.length > 0 && (
            <span className="byline" style={{ color: "var(--rule)" }}>—</span>
          )}
          {sourceLabel && (
            <span className="byline" style={{ color: "var(--ink-3)" }}>{sourceLabel}</span>
          )}
          {date && (
            <time className="byline" style={{ color: "var(--ink-3)" }}>{date}</time>
          )}
          {hasCitations && (
            <>
              <span className="byline" style={{ color: "var(--rule)" }}>·</span>
              <span className="byline" style={{ color: "var(--ink-3)" }}>
                {formatCitations(paper.citationCount!)} citations
              </span>
            </>
          )}
        </div>

        {/* Abstract — serif, longer */}
        {paper.abstract && (
          <p
            className="abstract-clamp-6 leading-[1.85] mb-6"
            style={{
              fontSize: "0.9375rem",
              color: "var(--ink-2)",
              fontFamily: "Georgia, 'Times New Roman', Times, serif",
            }}
          >
            {paper.abstract}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-5">
          {primarySource && (
            <a
              href={primarySource.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold hover:underline underline-offset-2 transition-opacity hover:opacity-80"
              style={{ color: "var(--accent-2)" }}
            >
              Read paper →
            </a>
          )}
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm hover:underline underline-offset-2 transition-opacity hover:opacity-70"
              style={{ color: "var(--ink-2)" }}
            >
              Download PDF
            </a>
          )}
          <Link
            href={`/papers/${paper.id}`}
            className="text-sm hover:underline underline-offset-2 transition-opacity hover:opacity-70"
            style={{ color: "var(--ink-3)" }}
          >
            Full details
          </Link>
        </div>
      </article>
    );
  }

  /* ── Regular card ────────────────────────────────────── */
  return (
    <article
      className="paper-hover py-5 border-b last:border-b-0"
      style={{ borderColor: "var(--rule)" }}
    >
      {/* Top row: label + date + source + bookmark */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
          {label && <span className="tag-pill shrink-0">{label}</span>}
          {orgTag && <OrgBadge tag={orgTag} />}
          {(sourceLabel || date) && (
            <span className="byline" style={{ color: "var(--ink-3)" }}>
              {[sourceLabel, date].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
        <BookmarkBtn paperId={paper.id} />
      </div>

      {/* Title */}
      <Link href={`/papers/${paper.id}`}>
        <h2
          className="font-serif text-[1.2rem] leading-snug mb-2 hover:underline underline-offset-2 decoration-1 transition-opacity hover:opacity-80"
          style={{ color: "var(--ink)", letterSpacing: "-0.005em" }}
        >
          {paper.title}
        </h2>
      </Link>

      {/* Authors + citations */}
      {paper.authors.length > 0 && (
        <p className="byline mb-2.5" style={{ color: "var(--ink-2)" }}>
          {formatAuthors(paper.authors, 3)}
          {hasCitations && (
            <span style={{ color: "var(--ink-3)" }}>
              {" "}· {formatCitations(paper.citationCount!)} citations
            </span>
          )}
        </p>
      )}

      {/* Abstract */}
      {paper.abstract && (
        <p
          className="abstract-clamp text-sm leading-relaxed mb-3"
          style={{ color: "var(--ink-2)", lineHeight: 1.7 }}
        >
          {paper.abstract}
        </p>
      )}

      {/* Footer: actions left, extra tags right */}
      <div className="flex items-center gap-4">
        {primarySource && (
          <a
            href={primarySource.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold hover:underline underline-offset-2 transition-opacity hover:opacity-80"
            style={{ color: "var(--accent-2)" }}
          >
            Read paper →
          </a>
        )}
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs hover:underline underline-offset-2 transition-opacity hover:opacity-70"
            style={{ color: "var(--ink-3)" }}
          >
            PDF
          </a>
        )}
        {extra.length > 0 && (
          <div className="ml-auto flex gap-1.5">
            {extra.slice(0, 2).map((t) => (
              <span key={t} className="tag-pill tag-pill-muted">{t}</span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

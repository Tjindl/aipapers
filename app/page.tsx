"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { PaperCard, type Paper } from "./components/PaperCard";
import { FilterPanel, type Filters } from "./components/FilterPanel";
import { Pagination } from "./components/Pagination";
import { ThemeToggle } from "./components/ThemeToggle";

const DEFAULT_FILTERS: Filters = {
  source: "",
  tag: "",
  category: "",
  dateFrom: "",
  dateTo: "",
  minCitations: "",
  sort: "newest",
};

interface ApiResponse {
  papers: Paper[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

interface SourceInfo {
  name: string;
  label: string;
  enabled: boolean;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function NeuralNetSVG({ mirror = false }: { mirror?: boolean }) {
  // Unique filter IDs per instance to avoid SVG conflicts
  const gid = mirror ? "nn-b" : "nn-a";
  return (
    <svg
      viewBox="0 0 82 58"
      fill="none"
      aria-hidden="true"
      className="h-10 sm:h-14 md:h-16 w-auto shrink-0"
      style={{ transform: mirror ? "scaleX(-1)" : undefined }}
    >
      <defs>
        <filter id={gid} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── All connections (muted base layer) ── */}
      {/* L1 → L2 */}
      <line x1="8" y1="14" x2="41" y2="6"  stroke="var(--rule)" strokeWidth="1.1"/>
      <line x1="8" y1="14" x2="41" y2="29" stroke="var(--rule)" strokeWidth="1.1"/>
      <line x1="8" y1="14" x2="41" y2="52" stroke="var(--rule)" strokeWidth="1.1"/>
      <line x1="8" y1="44" x2="41" y2="6"  stroke="var(--rule)" strokeWidth="1.1"/>
      <line x1="8" y1="44" x2="41" y2="29" stroke="var(--rule)" strokeWidth="1.1"/>
      <line x1="8" y1="44" x2="41" y2="52" stroke="var(--rule)" strokeWidth="1.1"/>
      {/* L2 → L3 */}
      <line x1="41" y1="6"  x2="74" y2="14" stroke="var(--rule)" strokeWidth="1.1"/>
      <line x1="41" y1="6"  x2="74" y2="44" stroke="var(--rule)" strokeWidth="1.1"/>
      <line x1="41" y1="29" x2="74" y2="14" stroke="var(--rule)" strokeWidth="1.1"/>
      <line x1="41" y1="29" x2="74" y2="44" stroke="var(--rule)" strokeWidth="1.1"/>
      <line x1="41" y1="52" x2="74" y2="14" stroke="var(--rule)" strokeWidth="1.1"/>
      <line x1="41" y1="52" x2="74" y2="44" stroke="var(--rule)" strokeWidth="1.1"/>

      {/* ── Active signal path (highlighted) ── */}
      <line x1="8"  y1="14" x2="41" y2="29" stroke="var(--accent)" strokeWidth="1.4" strokeOpacity="0.5"/>
      <line x1="41" y1="29" x2="74" y2="44" stroke="var(--accent)" strokeWidth="1.4" strokeOpacity="0.5"/>

      {/* ── Input nodes ── */}
      <circle cx="8" cy="14" r="4.5" fill="var(--paper)" stroke="var(--accent)" strokeWidth="1.5"/>
      <circle cx="8" cy="44" r="4.5" fill="var(--paper)" stroke="var(--ink-3)" strokeWidth="1.25"/>

      {/* ── Hidden nodes ── */}
      <circle cx="41" cy="6"  r="3.5" fill="var(--paper)" stroke="var(--ink-3)" strokeWidth="1.25"/>
      {/* Center node — glowing, pulsing */}
      <circle cx="41" cy="29" r="6"   fill="var(--accent)" className="nn-pulse" filter={`url(#${gid})`}/>
      <circle cx="41" cy="52" r="3.5" fill="var(--paper)" stroke="var(--ink-3)" strokeWidth="1.25"/>

      {/* ── Output nodes ── */}
      <circle cx="74" cy="14" r="4.5" fill="var(--paper)" stroke="var(--ink-3)" strokeWidth="1.25"/>
      <circle cx="74" cy="44" r="4.5" fill="var(--paper)" stroke="var(--accent)" strokeWidth="1.5"/>
    </svg>
  );
}

export default function Home() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const limit = 20;

  const debouncedQuery = useDebounce(query, 350);
  const fetchCountRef = useRef(0);

  useEffect(() => {
    fetch("/api/sources")
      .then((r) => r.json())
      .then((data: SourceInfo[]) => setSources(data))
      .catch(() => {});
  }, []);

  const loadPapers = useCallback(async (p: number) => {
    const fetchId = ++fetchCountRef.current;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (debouncedQuery) params.set("query", debouncedQuery);
    if (filters.source) params.set("source", filters.source);
    if (filters.tag) params.set("tag", filters.tag);
    if (filters.category) params.set("category", filters.category);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.minCitations) params.set("minCitations", filters.minCitations);
    params.set("sort", filters.sort);
    params.set("page", String(p));
    params.set("limit", String(limit));

    try {
      const res = await fetch(`/api/papers?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ApiResponse;
      if (fetchId !== fetchCountRef.current) return;
      setPapers(data.papers);
      setTotal(data.total);
      setPages(data.pages);
      setPage(data.page);
    } catch (err) {
      if (fetchId !== fetchCountRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load papers");
    } finally {
      if (fetchId === fetchCountRef.current) setLoading(false);
    }
  }, [debouncedQuery, filters, limit]);

  useEffect(() => { loadPapers(1); }, [loadPapers]);

  function handlePageChange(p: number) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    loadPapers(p);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)", color: "var(--ink)" }}>
      {/* ── Masthead ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-20" style={{ background: "var(--paper)" }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-8">

          {/* Accent bar */}
          <div style={{ height: "3px", background: "var(--accent-top)", margin: "0 -1.25rem" }} />

          {/* Top bar: date left · controls right */}
          <div
            className="flex items-center justify-between py-2.5"
            style={{ borderBottom: "1px solid var(--rule)" }}
          >
            <p className="byline" style={{ color: "var(--ink-3)", fontSize: "0.75rem" }}>
              {todayLabel()}
            </p>
            <ThemeToggle />
          </div>

          {/* Nameplate */}
          <div className="text-center py-5" style={{ borderBottom: "3px double var(--rule)" }}>
            <div className="flex items-center justify-center gap-4 sm:gap-7">
              <NeuralNetSVG />
              <h1
                className="font-serif"
                style={{
                  fontSize: "clamp(2.25rem, 6vw, 4rem)",
                  lineHeight: 1.05,
                  color: "var(--ink)",
                  letterSpacing: "-0.02em",
                }}
              >
                Corpus
              </h1>
              <NeuralNetSVG mirror />
            </div>
            <p
              className="mt-1.5"
              style={{
                color: "var(--ink-3)",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontSize: "0.6rem",
                fontWeight: 600,
              }}
            >
              The Daily Digest of Artificial Intelligence Research
            </p>
          </div>

          {/* Search */}
          <div
            className="flex items-center gap-2 py-3"
            style={{ borderBottom: "1px solid var(--rule)" }}
          >
            <svg
              className="w-3.5 h-3.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ color: "var(--ink-3)" }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles, abstracts, authors…"
              className="w-full bg-transparent border-none outline-none text-sm"
              style={{ color: "var(--ink)", caretColor: "var(--accent)" }}
            />
          </div>

          {/* Filter bar */}
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            sources={sources}
            total={total}
          />
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-4">
        {error && (
          <p className="byline mb-6 py-3" style={{ color: "var(--accent)", borderBottom: "1px solid var(--rule)" }}>
            Error: {error}
          </p>
        )}

        {loading ? (
          // Skeleton — newspaper lines
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="py-5 animate-pulse"
                style={{ borderBottom: "1px solid var(--rule)" }}
              >
                <div className="h-2.5 rounded w-24 mb-3" style={{ background: "var(--rule)" }} />
                <div className="h-5 rounded w-3/4 mb-2 font-serif" style={{ background: "var(--rule)" }} />
                <div className="h-4 rounded w-1/2 mb-3" style={{ background: "var(--rule)" }} />
                <div className="space-y-1.5">
                  <div className="h-3 rounded" style={{ background: "var(--rule)" }} />
                  <div className="h-3 rounded w-11/12" style={{ background: "var(--rule)" }} />
                  <div className="h-3 rounded w-4/5" style={{ background: "var(--rule)" }} />
                </div>
              </div>
            ))}
          </div>
        ) : papers.length === 0 ? (
          <div className="text-center py-24">
            <p
              className="font-serif mb-3"
              style={{ fontSize: "1.5rem", color: "var(--ink-2)", letterSpacing: "-0.01em" }}
            >
              {debouncedQuery || [filters.source, filters.tag, filters.category, filters.dateFrom, filters.dateTo, filters.minCitations].some(Boolean)
                ? "No papers match"
                : "Your briefing is empty"}
            </p>
            <p className="byline" style={{ color: "var(--ink-3)", maxWidth: "28rem", margin: "0 auto" }}>
              {debouncedQuery || [filters.source, filters.tag, filters.category, filters.dateFrom, filters.dateTo, filters.minCitations].some(Boolean)
                ? "Try broadening your search terms or clearing the active filters."
                : "New papers are added every morning. Check back soon."}
            </p>
          </div>
        ) : (
          <>
            {/* Two-column newspaper grid on md+ */}
            <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-10">
              {papers.map((paper, i) => (
                <div
                  key={paper.id}
                  className={
                    // First paper spans full width as "lead story"
                    i === 0 ? "md:col-span-2" : ""
                  }
                >
                  <PaperCard paper={paper} featured={i === 0} />
                </div>
              ))}
            </div>
            <Pagination page={page} pages={pages} total={total} limit={limit} onPageChange={handlePageChange} />
          </>
        )}
      </main>
    </div>
  );
}

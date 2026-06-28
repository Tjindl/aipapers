"use client";

import { KNOWN_ORGANIZATIONS, KNOWN_TOPICS } from "@/lib/tagger";

export interface Filters {
  source: string;
  tag: string;
  category: string;
  dateFrom: string;
  dateTo: string;
  minCitations: string;
  sort: string;
}

interface FilterPanelProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  sources: Array<{ name: string; label: string; enabled: boolean }>;
  total: number;
}

const ARXIV_CATEGORIES = [
  { value: "cs.AI",   label: "cs.AI — Artificial Intelligence" },
  { value: "cs.LG",   label: "cs.LG — Machine Learning" },
  { value: "cs.CL",   label: "cs.CL — NLP" },
  { value: "cs.CV",   label: "cs.CV — Computer Vision" },
  { value: "cs.NE",   label: "cs.NE — Neural Computing" },
  { value: "cs.RO",   label: "cs.RO — Robotics" },
  { value: "cs.MA",   label: "cs.MA — Multi-Agent" },
  { value: "stat.ML", label: "stat.ML — ML (Stats)" },
  { value: "eess.AS", label: "eess.AS — Audio & Speech" },
  { value: "eess.IV", label: "eess.IV — Image & Video" },
];

const VENUES = [
  "NeurIPS", "ICLR", "ICML", "ACL", "EMNLP", "CVPR", "ECCV", "ICCV",
];

const SORT_OPTIONS = [
  { value: "newest",  label: "Newest first" },
  { value: "oldest",  label: "Oldest first" },
  { value: "citations", label: "Most cited" },
  { value: "fetched", label: "Recently added" },
];

export function FilterPanel({ filters, onChange, sources, total }: FilterPanelProps) {
  function update(key: keyof Filters, value: string) {
    onChange({ ...filters, [key]: value });
  }

  function reset() {
    onChange({ source: "", tag: "", category: "", dateFrom: "", dateTo: "", minCitations: "", sort: "newest" });
  }

  const activeCount = [filters.source, filters.tag, filters.category, filters.dateFrom, filters.dateTo, filters.minCitations].filter(Boolean).length;

  return (
    <div>
      {/* Filter bar — horizontal scrollable row of minimal selects */}
      <div
        className="flex items-center gap-0 flex-wrap"
        style={{ borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)", padding: "8px 0" }}
      >
        {/* Source */}
        <FilterSelect
          value={filters.source}
          onChange={(v) => update("source", v)}
          placeholder="All sources"
        >
          {sources.map((s) => (
            <option key={s.name} value={s.name} disabled={!s.enabled}>
              {s.label}
            </option>
          ))}
        </FilterSelect>

        <Sep />

        {/* Organizations */}
        <FilterSelect
          value={filters.tag && KNOWN_ORGANIZATIONS.includes(filters.tag) ? filters.tag : ""}
          onChange={(v) => update("tag", v)}
          placeholder="All orgs"
        >
          {KNOWN_ORGANIZATIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </FilterSelect>

        <Sep />

        {/* Topics */}
        <FilterSelect
          value={filters.tag && KNOWN_TOPICS.includes(filters.tag) ? filters.tag : ""}
          onChange={(v) => update("tag", v)}
          placeholder="All topics"
        >
          {KNOWN_TOPICS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </FilterSelect>

        <Sep />

        {/* Category */}
        <FilterSelect
          value={filters.category}
          onChange={(v) => update("category", v)}
          placeholder="Category"
        >
          <optgroup label="arXiv">
            {ARXIV_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </optgroup>
          <optgroup label="Venues">
            {VENUES.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </optgroup>
        </FilterSelect>

        <Sep />

        {/* Date from */}
        <label className="byline flex items-center gap-1.5 px-2" style={{ color: "var(--ink-2)" }}>
          <span className="text-xs" style={{ color: "var(--ink-3)" }}>From</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => update("dateFrom", e.target.value)}
            className="filter-select"
            style={{ paddingRight: "0.25rem" }}
          />
        </label>

        <Sep />

        {/* Min citations */}
        <label className="byline flex items-center gap-1.5 px-2" style={{ color: "var(--ink-2)" }}>
          <span className="text-xs" style={{ color: "var(--ink-3)" }}>Min cites</span>
          <input
            type="number"
            min="0"
            value={filters.minCitations}
            onChange={(e) => update("minCitations", e.target.value)}
            placeholder="—"
            className="filter-select w-12"
            style={{ paddingRight: "0.25rem" }}
          />
        </label>

        <Sep />

        {/* Sort */}
        <FilterSelect
          value={filters.sort}
          onChange={(v) => update("sort", v)}
          placeholder=""
          alwaysShow
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </FilterSelect>

        {/* Reset */}
        {activeCount > 0 && (
          <>
            <Sep />
            <button
              onClick={reset}
              className="text-xs px-2 transition-opacity hover:opacity-60"
              style={{ color: "var(--accent)" }}
            >
              Clear ×
            </button>
          </>
        )}
      </div>

      {/* Active tags */}
      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
          {[
            filters.source && { label: filters.source, key: "source" },
            filters.tag && { label: filters.tag, key: "tag" },
            filters.category && { label: filters.category, key: "category" },
            filters.dateFrom && { label: `From ${filters.dateFrom}`, key: "dateFrom" },
            filters.dateTo && { label: `To ${filters.dateTo}`, key: "dateTo" },
            filters.minCitations && { label: `≥${filters.minCitations} cites`, key: "minCitations" },
          ]
            .filter(Boolean)
            .map((f) => f && (
              <button
                key={f.key}
                onClick={() => update(f.key as keyof Filters, "")}
                className="section-label hover:line-through transition-all"
                style={{ color: "var(--ink-2)" }}
              >
                {f.label} ×
              </button>
            ))}
        </div>
      )}

      {/* Stats row */}
      <p className="byline mt-2" style={{ color: "var(--ink-3)" }}>
        {total > 0 ? `${total.toLocaleString()} paper${total === 1 ? "" : "s"}${activeCount > 0 ? " matching filters" : " indexed"}` : ""}
      </p>
    </div>
  );
}

function Sep() {
  return <span className="byline px-1 select-none" style={{ color: "var(--rule)" }}>|</span>;
}

function FilterSelect({
  value, onChange, placeholder, alwaysShow, children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  alwaysShow?: boolean;
  children: React.ReactNode;
}) {
  const isActive = Boolean(value);
  return (
    <div className="relative px-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="filter-select"
        style={{
          fontWeight: isActive ? 600 : 400,
          color: isActive ? "var(--ink)" : "var(--ink-2)",
          minWidth: alwaysShow ? undefined : "unset",
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
    </div>
  );
}

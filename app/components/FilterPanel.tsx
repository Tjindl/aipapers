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

const SORT_OPTIONS = [
  { value: "newest",    label: "Newest first" },
  { value: "oldest",    label: "Oldest first" },
  { value: "citations", label: "Most cited" },
  { value: "fetched",   label: "Recently added" },
];

export function FilterPanel({ filters, onChange, sources, total }: FilterPanelProps) {
  function update(key: keyof Filters, value: string) {
    onChange({ ...filters, [key]: value });
  }

  function reset() {
    onChange({ source: "", tag: "", category: "", dateFrom: "", dateTo: "", minCitations: "", sort: "newest" });
  }

  // A tag can be either a topic or an org — detect which
  const activeTopicTag = filters.tag && KNOWN_TOPICS.includes(filters.tag) ? filters.tag : "";
  const activeOrgTag   = filters.tag && KNOWN_ORGANIZATIONS.includes(filters.tag) ? filters.tag : "";

  const secondaryActive = [
    filters.source,
    activeOrgTag,
    filters.dateFrom,
    filters.dateTo,
    filters.minCitations,
  ].some(Boolean);

  const anyActive = activeTopicTag || secondaryActive;

  return (
    <div>
      {/* ── Topic chips ──────────────────────────────────── */}
      <div
        className="overflow-x-auto no-scrollbar py-3"
        style={{ borderBottom: "1px solid var(--rule)" }}
      >
        <div className="flex items-center gap-2" style={{ minWidth: "max-content" }}>
          <button
            className={`chip${!activeTopicTag ? " chip-active" : ""}`}
            onClick={() => update("tag", "")}
          >
            All Topics
          </button>
          {KNOWN_TOPICS.map((t) => (
            <button
              key={t}
              className={`chip${activeTopicTag === t ? " chip-active" : ""}`}
              onClick={() => update("tag", activeTopicTag === t ? "" : t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Secondary controls ───────────────────────────── */}
      <div
        className="flex items-center justify-between gap-3 py-2.5 flex-wrap"
        style={{ borderBottom: "1px solid var(--rule)" }}
      >
        {/* Left: source, org, date, cites, clear */}
        <div className="flex items-center gap-0 flex-wrap">
          {/* Source */}
          <ControlSelect
            value={filters.source}
            onChange={(v) => update("source", v)}
            placeholder="All sources"
          >
            {sources.map((s) => (
              <option key={s.name} value={s.name} disabled={!s.enabled}>
                {s.label}
              </option>
            ))}
          </ControlSelect>

          <Pipe />

          {/* Org */}
          <ControlSelect
            value={activeOrgTag}
            onChange={(v) => update("tag", v)}
            placeholder="All orgs"
          >
            {KNOWN_ORGANIZATIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </ControlSelect>

          <Pipe />

          {/* Date from */}
          <label className="flex items-center gap-1.5 px-2">
            <span style={{ fontSize: "0.75rem", color: "var(--ink-3)", fontWeight: 500 }}>From</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => update("dateFrom", e.target.value)}
              className="filter-select"
              style={{ paddingRight: "0.25rem" }}
            />
          </label>

          <Pipe />

          {/* Min citations */}
          <label className="flex items-center gap-1.5 px-2">
            <span style={{ fontSize: "0.75rem", color: "var(--ink-3)", fontWeight: 500 }}>Min cites</span>
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

          {anyActive && (
            <>
              <Pipe />
              <button
                onClick={reset}
                className="text-xs px-2 font-medium transition-opacity hover:opacity-60"
                style={{ color: "var(--accent)" }}
              >
                Clear all ×
              </button>
            </>
          )}
        </div>

        {/* Right: sort */}
        <ControlSelect
          value={filters.sort}
          onChange={(v) => update("sort", v)}
          placeholder=""
          alwaysShow
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </ControlSelect>
      </div>

      {/* ── Stats ────────────────────────────────────────── */}
      {total > 0 && (
        <p
          className="byline pt-2 pb-1"
          style={{ color: "var(--ink-3)", fontSize: "0.75rem" }}
        >
          {total.toLocaleString()} paper{total === 1 ? "" : "s"}
          {anyActive ? " matching filters" : " indexed"}
        </p>
      )}
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────── */

function Pipe() {
  return (
    <span
      className="select-none"
      style={{ color: "var(--rule)", fontSize: "0.8125rem", padding: "0 0.1rem" }}
    >
      |
    </span>
  );
}

function ControlSelect({
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
    <div className="px-2">
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

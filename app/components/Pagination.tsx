"use client";

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pages, total, limit, onPageChange }: PaginationProps) {
  if (pages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div
      className="flex items-center justify-between py-6"
      style={{ borderTop: "1px solid var(--rule)" }}
    >
      <p className="byline" style={{ color: "var(--ink-3)" }}>
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </p>

      <div className="flex items-center gap-6">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="byline disabled:opacity-30 hover:underline underline-offset-2 transition-opacity"
          style={{ color: "var(--ink-2)" }}
        >
          ← Previous
        </button>

        <span className="byline" style={{ color: "var(--ink-3)" }}>
          {page} / {pages}
        </span>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === pages}
          className="byline disabled:opacity-30 hover:underline underline-offset-2 transition-opacity"
          style={{ color: "var(--ink-2)" }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

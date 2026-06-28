"use client";

import { useState } from "react";

interface FetchResult {
  source: string;
  fetched: number;
  created: number;
  updated: number;
  errors: number;
}

export function FetchButton({ onComplete }: { onComplete?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function handleFetch() {
    setLoading(true);
    setToast(null);
    try {
      const res = await fetch("/api/fetch?maxResults=100", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { results: FetchResult[] };
      const totalCreated = data.results.reduce((sum, r) => sum + r.created, 0);
      const totalUpdated = data.results.reduce((sum, r) => sum + r.updated, 0);
      setToast(`${totalCreated} new · ${totalUpdated} updated`);
      onComplete?.();
    } catch {
      setToast("Fetch failed");
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleFetch}
        disabled={loading}
        className="text-xs font-medium disabled:opacity-40 hover:underline underline-offset-2 transition-opacity flex items-center gap-1"
        style={{ color: "var(--ink-2)" }}
      >
        {loading ? (
          <>
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Fetching…
          </>
        ) : (
          <>↻ Refresh All</>
        )}
      </button>

      {toast && (
        <span className="text-xs transition-opacity" style={{ color: "var(--ink-3)" }}>
          {toast}
        </span>
      )}
    </div>
  );
}

/**
 * Daily Cron Endpoint
 *
 * POST /api/cron  — fetch all enabled adapters (past 2 weeks) then prune papers
 *                   older than 14 days.
 *
 * Authentication: requires CRON_SECRET header (or FETCH_SECRET as fallback).
 * Leave CRON_SECRET unset for local dev (open access).
 *
 * Vercel Cron: add to vercel.json:
 *   { "crons": [{ "path": "/api/cron", "schedule": "0 6 * * *" }] }
 *
 * Local cron (runs the script directly, no HTTP needed):
 *   0 6 * * * cd /path/to/corpus && npx tsx scripts/fetch.ts --prune >> /tmp/corpus-cron.log 2>&1
 */

import { NextRequest, NextResponse } from "next/server";
import { enabledAdapters } from "@/lib/adapters";
import { runAdapter, prunePapers, twoWeeksAgo } from "@/lib/fetcher";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.FETCH_SECRET;
  if (!secret) return true;
  // Vercel sends Authorization: Bearer <CRON_SECRET>
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  const header = req.headers.get("x-cron-secret");
  return bearer === secret || header === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = twoWeeksAgo();
  const options = { maxResults: 200, since };

  console.log(`[cron] Starting daily fetch+prune at ${new Date().toISOString()}`);

  const fetchResults = [];
  for (const adapter of enabledAdapters()) {
    const r = await runAdapter(adapter, options);
    fetchResults.push(r);
  }

  const pruned = await prunePapers(14);
  console.log(`[cron] Pruned ${pruned} papers older than 14 days`);

  const summary = {
    ranAt: new Date().toISOString(),
    pruned,
    sources: fetchResults.map((r) => ({
      source: r.source,
      fetched: r.fetched,
      created: r.created,
      updated: r.updated,
      errors: r.errors,
    })),
  };

  console.log("[cron] Done", JSON.stringify(summary));
  return NextResponse.json(summary);
}

// Also support GET for Vercel Cron (which uses GET by default)
export { POST as GET };

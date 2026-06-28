import { NextRequest, NextResponse } from "next/server";
import { enabledAdapters, getAdapter } from "@/lib/adapters";
import { runAdapter, twoWeeksAgo } from "@/lib/fetcher";

export const dynamic = "force-dynamic";
// Allow up to 5 minutes for long fetch operations
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.FETCH_SECRET;
  if (!secret) return true; // No secret set = open (suitable for local dev)
  const auth = req.headers.get("x-fetch-secret") ?? req.nextUrl.searchParams.get("secret");
  return auth === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const sourceName = searchParams.get("source");
  const maxResults = parseInt(searchParams.get("maxResults") ?? "200", 10);
  const query = searchParams.get("query") ?? undefined;
  // Default to past 2 weeks; pass since=all to override
  const sinceParam = searchParams.get("since");
  const since = sinceParam === "all" ? undefined : sinceParam ? new Date(sinceParam) : twoWeeksAgo();

  const options = { maxResults, query, since };

  const targets = sourceName
    ? (() => {
        const a = getAdapter(sourceName);
        return a ? [a] : null;
      })()
    : enabledAdapters();

  if (!targets) {
    return NextResponse.json({ error: `Unknown source: ${sourceName}` }, { status: 400 });
  }

  const results = [];
  for (const adapter of targets) {
    const r = await runAdapter(adapter, options);
    results.push(r);
  }

  return NextResponse.json({ results });
}

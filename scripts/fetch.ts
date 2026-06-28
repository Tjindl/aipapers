#!/usr/bin/env node
/**
 * Fetch / refresh script
 *
 * Usage:
 *   npx tsx scripts/fetch.ts                      # fetch all sources, past 2 weeks (default)
 *   npx tsx scripts/fetch.ts --source arxiv        # single source
 *   npx tsx scripts/fetch.ts --source organizations # org-specific papers only
 *   npx tsx scripts/fetch.ts --max 50              # limit results per source
 *   npx tsx scripts/fetch.ts --query "diffusion"   # narrow query
 *   npx tsx scripts/fetch.ts --since 2024-01-01    # override date window
 *   npx tsx scripts/fetch.ts --since all           # fetch all time (no date filter)
 *   npx tsx scripts/fetch.ts --prune               # also prune papers older than 14 days
 *   npx tsx scripts/fetch.ts --no-fetch --prune    # prune only, no fetch
 */

import "dotenv/config";

import { enabledAdapters, getAdapter } from "../lib/adapters";
import { runAdapter, prunePapers, twoWeeksAgo } from "../lib/fetcher";

function parseArgs() {
  const args = process.argv.slice(2);
  const result: {
    source?: string;
    max: number;
    query?: string;
    since?: Date | null; // null = all time
    prune: boolean;
    noFetch: boolean;
  } = { max: 200, prune: false, noFetch: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) result.source = args[++i];
    else if (args[i] === "--max" && args[i + 1]) result.max = parseInt(args[++i], 10);
    else if (args[i] === "--query" && args[i + 1]) result.query = args[++i];
    else if (args[i] === "--since" && args[i + 1]) {
      const v = args[++i];
      result.since = v === "all" ? null : new Date(v);
    }
    else if (args[i] === "--prune") result.prune = true;
    else if (args[i] === "--no-fetch") result.noFetch = true;
  }

  // Default: fetch only the past 2 weeks (unless --since was explicitly provided)
  if (result.since === undefined) result.since = twoWeeksAgo();

  return result;
}

async function main() {
  const { source, max, query, since, prune, noFetch } = parseArgs();

  if (!noFetch) {
    const targets = source
      ? (() => {
          const a = getAdapter(source);
          if (!a) {
            console.error(`Unknown source: "${source}". Available: ${enabledAdapters().map((x) => x.name).join(", ")}`);
            process.exit(1);
          }
          return [a];
        })()
      : enabledAdapters();

    const options = { maxResults: max, query, since: since ?? undefined };

    console.log(`\nFetching from: ${targets.map((a) => a.name).join(", ")}`);
    console.log(
      `Window: ${since ? since.toISOString().slice(0, 10) + " → now" : "all time"}` +
      (query ? `  query="${query}"` : "") +
      `  maxResults=${max}\n`
    );

    let totalCreated = 0, totalUpdated = 0, totalErrors = 0;

    for (const adapter of targets) {
      const r = await runAdapter(adapter, options);
      totalCreated += r.created;
      totalUpdated += r.updated;
      totalErrors += r.errors;
    }

    console.log(`\n=== Fetch Summary ===`);
    console.log(`Created: ${totalCreated}`);
    console.log(`Updated: ${totalUpdated}`);
    console.log(`Errors:  ${totalErrors}`);
  }

  if (prune) {
    console.log(`\nPruning papers older than 14 days…`);
    const pruned = await prunePapers(14);
    console.log(`Pruned:  ${pruned} papers`);
  }

  console.log(`Done.\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

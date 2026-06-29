#!/usr/bin/env node
/**
 * Backfill AI summaries for papers that don't have one yet.
 *
 * Usage:
 *   npx tsx scripts/backfill-summaries.ts
 *   npx tsx scripts/backfill-summaries.ts --limit 50   # only process N papers
 *
 * Requires ANTHROPIC_API_KEY in environment.
 * Adds a small delay between calls to avoid rate limits.
 */

import "dotenv/config";
import { prisma } from "../lib/prisma";
import { summarizePaper } from "../lib/summarizer";

const DELAY_MS = 300; // ~3 req/s, well within Haiku limits

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : undefined;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY is not set.");
    process.exit(1);
  }

  const papers = await prisma.paper.findMany({
    where: { summary: null, abstract: { not: null } },
    select: { id: true, title: true, abstract: true },
    orderBy: { fetchedAt: "desc" },
    ...(limit ? { take: limit } : {}),
  });

  console.log(`Found ${papers.length} papers without summaries.\n`);

  let done = 0, failed = 0;

  for (const paper of papers) {
    const summary = await summarizePaper(paper.title, paper.abstract!);
    if (summary) {
      await prisma.paper.update({ where: { id: paper.id }, data: { summary } });
      done++;
      process.stdout.write(`\r✓ ${done}/${papers.length} summarized  (${failed} failed)`);
    } else {
      failed++;
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n\nDone. ${done} summaries generated, ${failed} failed.\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

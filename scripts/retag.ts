#!/usr/bin/env node
/**
 * Re-tag all existing papers using the current tagger rules.
 * Run once after upgrading to the new tagging system:
 *   npx tsx scripts/retag.ts
 */

import "dotenv/config";
import { prisma } from "../lib/prisma";
import { normalizeTags } from "../lib/tagger";

async function main() {
  const papers = await prisma.paper.findMany({
    select: { id: true, title: true, abstract: true, categories: true },
  });

  console.log(`Re-tagging ${papers.length} papers…`);
  let updated = 0;

  for (const p of papers) {
    const rawCategories = JSON.parse(p.categories) as string[];
    const newTags = normalizeTags({
      title: p.title,
      abstract: p.abstract ?? undefined,
      rawCategories,
    });

    await prisma.paper.update({
      where: { id: p.id },
      data: { tags: JSON.stringify(newTags) },
    });
    updated++;
    if (updated % 50 === 0) process.stdout.write(`  ${updated}/${papers.length}\r`);
  }

  console.log(`\nDone. Updated ${updated} papers.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

# Claude Code Prompt — AI Research Paper Aggregator

> Paste this whole file into Claude Code (or save it as `SPEC.md` in an empty
> folder and tell Claude Code to build from it). Edit the **stack** and
> **scope** sections to taste before you start.

---

You are building a web app that aggregates AI/ML research papers from multiple
sources into one organized, searchable interface. Before writing code, lay out a
short plan / todo list and confirm the high-level architecture. Then build it
incrementally. Only stop to ask me if you hit a genuinely blocking decision.

## Goal

One website where I can browse, search, and filter AI research papers pulled
from many different sources, presented cleanly and consistently. The hard part
of this project is **data aggregation and normalization**, not the UI — design
for that first.

## Recommended stack (adjust if you have a strong reason, but ask me first before major swaps)

- **Next.js** (App Router, TypeScript)
- **Tailwind CSS** for styling
- **Prisma** ORM with **SQLite** to start (design the schema so it can move to
  Postgres for production with minimal changes)
- Data fetching done in **backend API routes / scripts**, never directly from
  the browser (avoids CORS, rate-limit, and API-key exposure problems)

## Architecture requirements

1. **Common schema.** Normalize every source into one `Paper` model. Suggested
   fields: `id`, `title`, `authors[]`, `abstract`, `source`, `sourceUrl`,
   `pdfUrl`, `publishedDate`, `categories[]` / `tags[]`, `doi`, `arxivId`,
   `citationCount` (nullable), `fetchedAt`.
2. **Pluggable source adapters.** Define a single `SourceAdapter` interface
   (e.g. given a query and/or date range, return papers in the common schema).
   Adding a new source should mean writing one new adapter, nothing else.
3. **Fetch → store → serve.** A backend job fetches from external APIs, writes
   normalized papers into the DB. The frontend reads only from our DB/API. Make
   fetching **incremental** (pull the latest N per source; upsert, don't
   duplicate).
4. **Deduplication.** The same paper appears in multiple sources. Dedupe by DOI,
   then arXiv ID, then fuzzy title match. Keep links to every source it was
   found in.
5. **Respect rate limits and Terms of Service.** Use **official APIs only**.
   Throttle requests to each source's documented limits. **Do NOT scrape Google
   Scholar** (against its ToS and actively blocked). If any source's API is
   unavailable or its terms prohibit this use, skip it and note it in the README
   rather than scraping around it.

## Data sources

Use official APIs. **Verify each one's current availability, base URL, auth
requirements, and terms before implementing** — treat the notes below as
starting points, not gospel, and confirm them as of today. Start with arXiv,
then add the rest one at a time via the adapter interface.

- **arXiv API** — primary source. Categories like `cs.AI`, `cs.LG`, `cs.CL`,
  `cs.CV`, `cs.NE`, `stat.ML`. Free, no key. (Note: returns Atom XML; throttle to
  the documented rate.)
- **Semantic Scholar API** — search plus citation counts. Free tier; an API key
  raises limits.
- **OpenReview API** — conference papers (NeurIPS, ICLR, etc.).
- **CrossRef API** — DOI metadata, good for enrichment/dedup.
- **CORE API** — large open-access aggregator (well suited to this use case).
- **DBLP** — bibliographic metadata.
- **Optional / verify status before adding:** Papers with Code, ACL Anthology,
  bioRxiv/medRxiv. (Some of these have changed or restricted access recently —
  check first and skip cleanly if unavailable.)

## Frontend features

Build the MVP first (arXiv only, end to end), then layer the rest on.

- **Paper feed** — cards with title, authors, a source badge, date, truncated
  abstract, and links (PDF + source page).
- **Search** — over title, abstract, and authors.
- **Filters** — by source, category/topic, date range, and (where available)
  minimum citation count.
- **Sort** — newest, most cited, relevance.
- **Detail view** (page or modal) — full abstract, all metadata, every source
  link, and any duplicate-source links.
- **Bookmark / save** papers (localStorage is fine for the MVP; DB-backed later).
- **Pagination or infinite scroll.**
- Clean, responsive, fast. Loading and empty states handled.

## Build approach (please follow this order)

1. Get a **working vertical slice with arXiv only**: fetch → store → display →
   search → filter. Make it runnable end to end before adding breadth.
2. Introduce the `SourceAdapter` abstraction and plug in additional sources one
   at a time.
3. Add **deduplication** and **citation enrichment** once the basics work.
4. Write a **seed/refresh script** I can run to populate and update the DB.
5. Keep all secrets in environment variables; include a `.env.example`.

## Deliverables

- A working app I can run locally with clearly documented commands.
- The extensible source-adapter system.
- A **README** covering: setup, where to put API keys, how to run the fetch/refresh
  job, how to run the dev server, and **how to add a new source**.
- Brief notes on **deployment** (e.g. Vercel + hosted Postgres) and on each
  source's rate limits and any terms I should be aware of.

## Constraints

- Prioritize a **working, good-looking MVP** over breadth of sources. A polished
  app with two solid sources beats a broken one wired to ten.
- "All AI papers from all resources" is effectively unbounded — frame this as
  aggregating from a **defined, easily extensible** set of high-quality sources.
- Flag and skip any source that can't be accessed via an official, ToS-compliant
  API.
- Ask me before any major stack change or before adding paid services.

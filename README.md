# Corpus

A newspaper-style reader for AI and machine learning research. Aggregates papers from arXiv and AI research organizations into a single searchable, filterable feed — updated daily with AI-generated plain-English summaries.

Built with Next.js 16, Prisma 6, PostgreSQL (Neon), Tailwind CSS v4, and Claude Haiku.

---

## Features

- **Daily auto-fetch** — Vercel Cron pulls new papers at 6 AM UTC; rolls a 14-day window
- **AI summaries** — Claude Haiku generates a 2–3 sentence plain-English summary per paper (~$0.75/month)
- **Multi-source** — arXiv categories (`cs.AI`, `cs.LG`, `cs.CL`, `cs.CV`, …) + AI org papers from Anthropic, OpenAI, DeepMind, Meta, Google, and more
- **Smart deduplication** — DOI → arXiv ID → normalized title matching
- **Auto-tagging** — 27 topic tags (LLMs, Diffusion Models, RL, AI Safety, Agents, …) and 20 organization tags
- **Full-text search** — title, abstract, author
- **Filters** — topic chips, organization, source, date range, min citations, sort
- **Org monogram badges** — color-coded org identity (OAI, GDM, META, …) on each card
- **Paper detail page** — full abstract + AI summary + related papers
- **Bookmarks** — saved to localStorage
- **Light / dark / system theme** — persisted to localStorage
- **Animated canvas header** — live neural network particle animation

---

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/Tjindl/aipapers.git
cd aipapers
npm install
```

### 2. Set up PostgreSQL

**Option A — Neon free tier (recommended):**
Create a project at [neon.tech](https://neon.tech). You'll get a pooled URL and a direct URL — you need both.

**Option B — Docker:**
```bash
docker run -d \
  --name corpus-pg \
  -e POSTGRES_DB=corpus \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16-alpine
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/corpus"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/corpus"
ANTHROPIC_API_KEY="sk-ant-..."   # optional but recommended
```

With Neon: `DATABASE_URL` = pooled URL, `DIRECT_URL` = direct URL (both shown in Neon dashboard).

### 4. Run migrations

```bash
DATABASE_URL="..." npx prisma migrate deploy
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The feed will be empty — run the fetch script to populate it.

### 6. Fetch papers

```bash
npm run fetch          # fetch all sources + prune old papers
npm run fetch:arxiv    # arXiv only
npm run fetch:orgs     # AI org papers only
```

### 7. (Optional) Backfill AI summaries

If you have papers already in the DB without summaries:

```bash
ANTHROPIC_API_KEY="sk-ant-..." npx tsx scripts/backfill-summaries.ts
```

---

## Deploying to Vercel

### 1. Push to GitHub

```bash
git remote add origin https://github.com/your-username/corpus.git
git push -u origin main
```

### 2. Import to Vercel

[Import the repository](https://vercel.com/new) — Vercel auto-detects Next.js. No framework config needed.

### 3. Set environment variables

In **Vercel → Project → Settings → Environment Variables**:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | **Yes** | Pooled PostgreSQL connection string |
| `DIRECT_URL` | **Yes** | Direct (non-pooled) connection string — for migrations |
| `ANTHROPIC_API_KEY` | Recommended | Enables AI summaries via Claude Haiku |
| `CRON_SECRET` | **Yes** | Protects `/api/cron`. Generate: `openssl rand -hex 32` |
| `SEMANTIC_SCHOLAR_API_KEY` | No | Raises S2 rate limit to 1 req/s (adapter disabled by default) |
| `CORE_API_KEY` | No | Required to enable the CORE adapter |
| `CROSSREF_CONTACT_EMAIL` | Recommended | Polite Pool access for CrossRef |

### 4. Run the initial migration

From your local machine with production env vars:

```bash
DATABASE_URL="<your-neon-direct-url>" npx prisma migrate deploy
```

### 5. Seed the database

```bash
DATABASE_URL="..." ANTHROPIC_API_KEY="..." npm run fetch
```

After the first deploy, the Vercel Cron at `0 6 * * *` (6 AM UTC) handles daily updates automatically.

---

## Project Structure

```
app/
  api/
    papers/           GET  /api/papers  — paginated search + filter
    sources/          GET  /api/sources — enabled adapter list
    cron/             GET  /api/cron    — daily fetch+prune (Vercel Cron)
  components/
    NeuralCanvas.tsx  Animated canvas header (particle network)
    PaperCard.tsx     Feed card (featured lead + regular)
    FilterPanel.tsx   Topic chips + secondary filter bar
    Pagination.tsx    Page controls
    ThemeToggle.tsx   Light / dark / system theme
  papers/[id]/        Paper detail page
  page.tsx            Main feed
lib/
  prisma.ts           Prisma client singleton
  fetcher.ts          Adapter orchestration, upsert, deduplication, pruning
  summarizer.ts       Claude Haiku summary generation
  tagger.ts           Topic + organization tag detection
  adapters/
    types.ts          SourceAdapter interface + NormalizedPaper type
    index.ts          Adapter registry
    arxiv.ts          arXiv Atom feed
    organizations.ts  AI org papers via arXiv author/org search
    semanticscholar.ts
    openreview.ts
    crossref.ts
    core.ts
    dblp.ts
prisma/
  schema.prisma       PostgreSQL schema
  migrations/         Migration history
scripts/
  fetch.ts            CLI fetch script (also used by npm run fetch)
  backfill-summaries.ts  Generate AI summaries for existing papers
  retag.ts            Re-apply tagging rules to all existing papers
```

---

## Adding a New Source

Create `lib/adapters/mysource.ts`:

```ts
import type { SourceAdapter, FetchOptions, NormalizedPaper } from "./types";

export class MySourceAdapter implements SourceAdapter {
  readonly name = "mysource";
  readonly label = "My Source";
  readonly enabled = true;

  async fetch(options: FetchOptions = {}): Promise<NormalizedPaper[]> {
    // fetch from API, normalize, return
  }
}
```

Register in `lib/adapters/index.ts`:

```ts
import { MySourceAdapter } from "./mysource";
// add to the adapters array
```

The fetcher, API routes, filter panel, and cron all pick it up automatically.

---

## Source Rate Limits

| Source | Limit | Auth | Status |
|---|---|---|---|
| arXiv | ~3s between requests | None | Enabled |
| Organizations (arXiv) | ~3s between requests | None | Enabled |
| Semantic Scholar | 100 req/5min · 1 req/s (with key) | Optional | Disabled* |
| OpenReview | ~1 req/s | None | Enabled |
| CrossRef | Polite Pool | Email recommended | Enabled |
| CORE | 10 req/min | API key required | Disabled* |
| DBLP | ~1 req/s | None | Enabled |

\* Set the relevant API key in env vars to enable.

> Google Scholar is intentionally excluded — scraping violates its Terms of Service.

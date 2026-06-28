# Corpus

A clean, newspaper-style reader for AI and machine learning research. Aggregates papers from arXiv, Semantic Scholar, OpenReview, CrossRef, CORE, and DBLP into a single searchable, filterable feed — updated daily.

Built with Next.js 16, Prisma 6, PostgreSQL, and Tailwind CSS v4.

---

## Features

- **Multi-source aggregation** — arXiv (including AI org papers from Anthropic, OpenAI, DeepMind, Meta, etc.), Semantic Scholar, OpenReview, CrossRef, CORE, DBLP
- **Smart deduplication** — DOI → arXiv ID → normalized title matching across sources
- **Auto-tagging** — 27 topic patterns (LLMs, Diffusion, RL, Safety, Agents, …) and 20 organization patterns
- **Rolling 2-week window** — auto-prunes papers older than 14 days
- **Daily cron** — Vercel Cron fetches all sources at 6 AM UTC
- **Full-text search** — title, abstract, author search
- **Filters** — source, organization, topic, arXiv category, date range, min citations
- **Light / dark / system theme** — persisted to localStorage

---

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/your-username/corpus.git
cd corpus
npm install
```

### 2. Set up PostgreSQL

**Option A — Docker (quickest):**
```bash
docker run -d \
  --name corpus-pg \
  -e POSTGRES_DB=corpus \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16-alpine
```

**Option B — Neon free tier:**
Create a project at [neon.tech](https://neon.tech), copy the connection string. Works for both local dev and production.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your database URLs:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/corpus"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/corpus"
```

If you're using Neon (which uses a connection pooler), `DATABASE_URL` gets the pooled URL and `DIRECT_URL` gets the direct URL — both are shown in the Neon dashboard.

### 4. Run database migrations

```bash
npx prisma migrate deploy
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The feed will be empty — click **↻ Refresh** to fetch your first batch of papers.

---

## Fetching Papers

### Via the UI

Click **↻ Refresh** in the top bar, choose a source from the dropdown, and click the button.

### Via CLI

```bash
# Fetch all sources + prune papers older than 14 days
npm run fetch

# Single source
npm run fetch:arxiv
npx tsx scripts/fetch.ts --source semanticscholar

# All sources, no date limit
npx tsx scripts/fetch.ts --since all

# Limit results per source
npx tsx scripts/fetch.ts --source arxiv --max 50

# Only prune, no fetch
npm run prune

# Re-apply current tagging rules to all existing papers
npm run retag
```

---

## Deploying to Vercel

### 1. Create a PostgreSQL database

The easiest option is **Neon** — it has a generous free tier and first-class Vercel integration:

1. Go to your [Vercel dashboard](https://vercel.com/dashboard) → **Storage** → **Create** → **Neon**
2. Follow the prompts; Vercel will automatically add `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and other env vars to your project

Alternatively use Supabase, Railway, or any PostgreSQL provider.

### 2. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/corpus.git
git push -u origin main
```

### 3. Import to Vercel

1. [Import the repository](https://vercel.com/new) on Vercel
2. Vercel auto-detects Next.js — no framework config needed
3. The `vercel.json` `buildCommand` (`prisma migrate deploy && next build`) runs migrations automatically on each deploy

### 4. Set environment variables

In **Vercel → Project → Settings → Environment Variables**, add:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | **Yes** | Pooled PostgreSQL URL (set automatically if using Vercel × Neon) |
| `DIRECT_URL` | **Yes** | Direct (non-pooled) PostgreSQL URL — used for migrations |
| `CRON_SECRET` | **Yes** | Protects `/api/cron`. Generate with `openssl rand -hex 32` |
| `FETCH_SECRET` | No | Protects `/api/fetch` from unauthorized triggers |
| `SEMANTIC_SCHOLAR_API_KEY` | No | Raises S2 rate limit to 1 req/s |
| `CORE_API_KEY` | No | Required to enable CORE adapter |
| `CROSSREF_CONTACT_EMAIL` | Recommended | Polite Pool access for CrossRef |

### 5. Set the Vercel Cron secret

In Vercel project settings → **Cron Jobs**, Vercel will automatically send `Authorization: Bearer <CRON_SECRET>` to `/api/cron` at 6 AM UTC daily (configured in `vercel.json`).

### 6. Bootstrap the database

After the first successful deploy, trigger an initial fetch manually:

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Fetch via the deployed API
curl -X POST https://your-app.vercel.app/api/fetch?source=arxiv \
  -H "x-fetch-secret: YOUR_FETCH_SECRET"
```

Or just open the deployed app and click **↻ Refresh** in the UI.

---

## Project Structure

```
app/
  api/
    papers/         GET /api/papers    — list/search with filters + pagination
    fetch/          POST /api/fetch    — trigger adapter run
    sources/        GET /api/sources   — list enabled adapters
    cron/           GET|POST /api/cron — daily fetch+prune (called by Vercel Cron)
  components/
    PaperCard.tsx   Paper list item (featured lead story + regular cards)
    FilterPanel.tsx Horizontal filter bar
    FetchButton.tsx ↻ Refresh button with source selector
    Pagination.tsx  ← Previous / Next →
    ThemeToggle.tsx Light/dark/system theme button
  papers/[id]/      Paper detail page
  page.tsx          Main feed
lib/
  prisma.ts         Prisma client singleton
  fetcher.ts        Adapter orchestration, deduplication, pruning
  tagger.ts         Tag normalization (topics + organizations)
  adapters/
    types.ts        SourceAdapter interface + NormalizedPaper type
    index.ts        Adapter registry
    arxiv.ts        arXiv Atom feed
    organizations.ts  AI org papers via arXiv search
    semanticscholar.ts
    openreview.ts
    crossref.ts
    core.ts
    dblp.ts
prisma/
  schema.prisma     Database schema (PostgreSQL)
  migrations/       Migration history
scripts/
  fetch.ts          CLI fetch script (also used by npm run fetch)
  retag.ts          Backfill tagging on existing papers
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
    // Fetch from API, normalize to NormalizedPaper, return array
  }
}
```

Register it in `lib/adapters/index.ts`:

```ts
import { MySourceAdapter } from "./mysource";

export const adapters: SourceAdapter[] = [
  // ...existing
  new MySourceAdapter(),
];
```

The fetcher, API routes, and UI pick it up automatically.

---

## Source Rate Limits

| Source | Limit | Auth |
|---|---|---|
| arXiv | ~3s between requests | None |
| Semantic Scholar | 100 req/5min (no key) · 1 req/s (with key) | Optional API key |
| OpenReview | ~1 req/s | None |
| CrossRef | Polite Pool (no hard limit) | Email in User-Agent |
| CORE | 10 req/min (free tier) | API key required |
| DBLP | ~1 req/s | None |

> Google Scholar is intentionally excluded — scraping violates its Terms of Service.

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ThemeToggle } from "@/app/components/ThemeToggle";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

const SOURCE_LABELS: Record<string, string> = {
  arxiv: "arXiv",
  semanticscholar: "Semantic Scholar",
  openreview: "OpenReview",
  crossref: "CrossRef",
  core: "CORE",
  dblp: "DBLP",
  organizations: "arXiv",
};

// Pick the most informative tag for the section label
function primaryLabel(tags: string[], categories: string[]): string {
  const topicTag = tags.find(
    (t) => !t.match(/^[a-z]{1,5}\.[A-Z]{2}/) && !["cs", "stat", "eess", "q-bio"].includes(t)
  );
  if (topicTag) return topicTag;
  return categories[0] ?? tags[0] ?? "";
}

export default async function PaperPage({ params }: Props) {
  const { id } = await params;

  const paper = await prisma.paper.findUnique({
    where: { id },
    include: { sources: true },
  });

  if (!paper) notFound();

  const authors = JSON.parse(paper.authors) as string[];
  const categories = JSON.parse(paper.categories) as string[];
  const tags = JSON.parse(paper.tags) as string[];

  const label = primaryLabel(tags, categories);
  const publishedDate = paper.publishedDate
    ? new Date(paper.publishedDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const fetchedDate = new Date(paper.fetchedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const pdfUrl = paper.sources.find((s) => s.pdfUrl)?.pdfUrl;
  const primarySource = paper.sources[0];

  // Deduplicate display tags (topics + orgs only, not raw arXiv codes)
  const displayTags = [...new Set([...tags, ...categories])].filter(
    (t) => !t.match(/^[a-z]{1,5}\.[A-Z]{2}/)
  );
  const allCategories = categories;

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)", color: "var(--ink)" }}>
      {/* ── Masthead strip ─────────────────────────────────── */}
      <header className="sticky top-0 z-20" style={{ background: "var(--paper)", borderBottom: "1px solid var(--rule)" }}>
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="byline hover:underline underline-offset-2 transition-opacity hover:opacity-70"
            style={{ color: "var(--ink-2)" }}
          >
            ← Corpus
          </Link>
          <div className="flex items-center gap-4">
            {publishedDate && (
              <p className="byline" style={{ color: "var(--ink-3)" }}>{publishedDate}</p>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Article ────────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-8">
        {/* Section label */}
        {label && (
          <p className="section-label mb-4">{label}</p>
        )}

        {/* Title */}
        <h1
          className="font-serif leading-tight mb-4"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)", color: "var(--ink)" }}
        >
          {paper.title}
        </h1>

        {/* Byline */}
        {authors.length > 0 && (
          <p className="byline mb-1">
            <span style={{ color: "var(--ink-3)" }}>By</span>{" "}
            <span style={{ color: "var(--ink-2)" }}>{authors.join(", ")}</span>
          </p>
        )}

        {/* Meta row */}
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 byline mb-6 pb-5"
          style={{ borderBottom: "3px double var(--rule)", color: "var(--ink-3)" }}
        >
          {publishedDate && <span>Published {publishedDate}</span>}
          {typeof paper.citationCount === "number" && paper.citationCount > 0 && (
            <span>{paper.citationCount.toLocaleString()} citations</span>
          )}
          {paper.doi && (
            <a
              href={`https://doi.org/${paper.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs hover:underline"
              style={{ color: "var(--accent-2)" }}
            >
              {paper.doi}
            </a>
          )}
          {paper.arxivId && (
            <a
              href={`https://arxiv.org/abs/${paper.arxivId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs hover:underline"
              style={{ color: "var(--accent-2)" }}
            >
              arXiv:{paper.arxivId}
            </a>
          )}
          <span>Indexed {fetchedDate}</span>
        </div>

        {/* Action links */}
        <div className="flex items-center gap-6 mb-8">
          {primarySource && (
            <a
              href={primarySource.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium hover:underline underline-offset-2 transition-opacity hover:opacity-70"
              style={{ color: "var(--accent-2)" }}
            >
              Read paper →
            </a>
          )}
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium hover:underline underline-offset-2 transition-opacity hover:opacity-70"
              style={{ color: "var(--ink-2)" }}
            >
              Download PDF →
            </a>
          )}
        </div>

        {/* Abstract */}
        {paper.abstract && (
          <section className="mb-8">
            <h2
              className="section-label mb-4"
              style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
            >
              Abstract
            </h2>
            <p
              style={{
                fontSize: "1.0625rem",
                color: "var(--ink)",
                fontFamily: "Georgia, 'Times New Roman', Times, serif",
                lineHeight: 1.85,
                maxWidth: "65ch",
              }}
            >
              {paper.abstract}
            </p>
          </section>
        )}

        {/* Topics & Categories */}
        {(displayTags.length > 0 || allCategories.length > 0) && (
          <section
            className="mb-8 pt-5"
            style={{ borderTop: "1px solid var(--rule)" }}
          >
            <h2 className="section-label mb-3" style={{ color: "var(--ink-3)" }}>
              Topics
            </h2>
            <div className="flex flex-wrap gap-2">
              {displayTags.map((t) => (
                <Link
                  key={t}
                  href={`/?tag=${encodeURIComponent(t)}`}
                  className="tag-pill transition-opacity hover:opacity-70"
                >
                  {t}
                </Link>
              ))}
              {allCategories.map((c) => (
                <Link
                  key={c}
                  href={`/?category=${encodeURIComponent(c)}`}
                  className="tag-pill tag-pill-muted font-mono transition-opacity hover:opacity-70"
                >
                  {c}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Sources */}
        {paper.sources.length > 0 && (
          <section
            className="pt-5"
            style={{ borderTop: "1px solid var(--rule)" }}
          >
            <h2 className="section-label mb-3" style={{ color: "var(--ink-3)" }}>
              Sources
            </h2>
            <div className="space-y-3">
              {paper.sources.map((s) => (
                <div key={s.source} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="section-label" style={{ color: "var(--ink-3)", letterSpacing: "0.06em" }}>
                    {SOURCE_LABELS[s.source] ?? s.source}
                  </span>
                  <a
                    href={s.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="byline hover:underline underline-offset-2 break-all"
                    style={{ color: "var(--accent-2)" }}
                  >
                    {s.sourceUrl}
                  </a>
                  {s.pdfUrl && (
                    <a
                      href={s.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="byline hover:underline underline-offset-2"
                      style={{ color: "var(--ink-3)" }}
                    >
                      PDF
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

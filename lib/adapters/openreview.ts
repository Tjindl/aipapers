/**
 * OpenReview Adapter
 *
 * API:  https://docs.openreview.net/reference/api-v2
 * Base: https://api2.openreview.net
 * Auth: None required for public data
 * Rate: Reasonable; ~1 req/s to be polite
 * Terms: https://openreview.net/legal/terms
 *
 * Fetches accepted papers from major ML conferences (NeurIPS, ICLR, ICML).
 */

import type { FetchOptions, NormalizedPaper, SourceAdapter } from "./types";

const BASE_URL = "https://api2.openreview.net";

// Invitation patterns for accepted papers at major conferences
// These may change each year; the script logs and skips unavailable invitations.
const CONFERENCE_INVITATIONS = [
  "NeurIPS.cc/2024/Conference/-/Accepted",
  "ICLR.cc/2025/Conference/-/Accepted",
  "ICLR.cc/2024/Conference/-/Accepted",
  "ICML.cc/2024/Conference/-/Accepted",
];

interface ORNote {
  id: string;
  content: {
    title?: { value?: string };
    authors?: { value?: string[] };
    abstract?: { value?: string };
    keywords?: { value?: string[] };
    pdf?: { value?: string };
    venueid?: { value?: string };
  };
  cdate?: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseNote(note: ORNote, invitation: string): NormalizedPaper | null {
  const title = note.content?.title?.value?.trim();
  if (!title) return null;

  const authors = note.content?.authors?.value ?? [];
  const abstract = note.content?.abstract?.value?.trim();
  const keywords = note.content?.keywords?.value ?? [];
  const pdfPath = note.content?.pdf?.value;

  const pdfUrl = pdfPath
    ? `https://openreview.net/pdf?id=${note.id}`
    : undefined;

  // Infer conference name from invitation
  const confMatch = invitation.match(/^([^/]+\/[^/]+)\//);
  const conf = confMatch ? confMatch[1] : invitation;

  return {
    title,
    authors,
    abstract,
    publishedDate: note.cdate ? new Date(note.cdate) : undefined,
    categories: [conf],
    tags: keywords,
    source: "openreview",
    sourceUrl: `https://openreview.net/forum?id=${note.id}`,
    pdfUrl,
  };
}

export class OpenReviewAdapter implements SourceAdapter {
  readonly name = "openreview";
  readonly label = "OpenReview";
  readonly enabled = true;

  async fetch(options: FetchOptions = {}): Promise<NormalizedPaper[]> {
    const { maxResults = 200 } = options;

    const papers: NormalizedPaper[] = [];
    const perInvitation = Math.ceil(maxResults / CONFERENCE_INVITATIONS.length);

    for (const invitation of CONFERENCE_INVITATIONS) {
      if (papers.length >= maxResults) break;

      let offset = 0;
      const limit = Math.min(100, perInvitation);
      let fetched = 0;

      while (fetched < perInvitation) {
        const url = new URL(`${BASE_URL}/notes`);
        url.searchParams.set("invitation", invitation);
        url.searchParams.set("details", "replyCount");
        url.searchParams.set("offset", String(offset));
        url.searchParams.set("limit", String(limit));

        try {
          const res = await fetch(url.toString());
          if (res.status === 404) {
            console.warn(`OpenReview: invitation not found: ${invitation}`);
            break;
          }
          if (!res.ok) {
            console.error(`OpenReview error ${res.status} for ${invitation}`);
            break;
          }

          const data = (await res.json()) as { notes?: ORNote[]; count?: number };
          const notes = data.notes ?? [];
          if (notes.length === 0) break;

          for (const note of notes) {
            const paper = parseNote(note, invitation);
            if (paper) papers.push(paper);
          }

          fetched += notes.length;
          offset += notes.length;
          if (notes.length < limit) break;
          await sleep(1000);
        } catch (err) {
          console.error(`OpenReview fetch error for ${invitation}:`, err);
          break;
        }
      }
    }

    return papers.slice(0, maxResults);
  }
}

/**
 * Summarizer — generates a 2–3 sentence plain-English summary of a paper
 * using Claude Haiku (cheapest Anthropic model, ~$0.0005 per paper).
 *
 * Called only for newly created papers that have an abstract.
 * Returns null silently on any error so it never blocks the fetch pipeline.
 */

import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

const SYSTEM_PROMPT =
  "You summarize AI research papers for a general audience. " +
  "Write exactly 2–3 sentences in plain English. " +
  "No jargon, no bullet points, no headers — just flowing prose. " +
  "Focus on: what problem is solved, how, and why it matters.";

export async function summarizePaper(
  title: string,
  abstract: string
): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Title: ${title}\n\nAbstract: ${abstract}`,
        },
      ],
    });

    const block = msg.content[0];
    if (block.type !== "text") return null;
    return block.text.trim() || null;
  } catch (err) {
    console.warn(`[summarizer] Failed for "${title.slice(0, 60)}":`, err);
    return null;
  }
}

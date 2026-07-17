import type { SupabaseClient } from "@supabase/supabase-js";
import { searchFaqIndex, type FaqHit } from "./faq-index";

export type KbHit = {
  id: string;
  title: string;
  summary: string;
  body: string;
  source: "kb" | "faq";
  score: number;
};

function scoreArticle(
  query: string,
  terms: string[],
  row: { title: string; summary: string; body_md: string; tags?: string[] },
): number {
  const hay = `${row.title} ${row.summary} ${row.body_md} ${(row.tags || []).join(" ")}`.toLowerCase();
  let score = 0;
  if (hay.includes(query)) score += 10;
  for (const t of terms) {
    if (hay.includes(t)) score += 3;
  }
  if (row.title.toLowerCase().includes(query)) score += 4;
  return score;
}

function faqToHit(entry: FaqHit, score: number): KbHit {
  return {
    id: entry.id,
    title: entry.title,
    summary: entry.summary,
    body: entry.body,
    source: "faq",
    score,
  };
}

export async function searchKnowledgeBase(
  service: SupabaseClient,
  query: string,
  limit = 3,
): Promise<KbHit[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const terms = q.split(/\s+/).filter((t) => t.length > 1);
  const hits: KbHit[] = [];

  const { data: articles } = await service
    .from("kb_articles")
    .select("id, slug, title, summary, body_md, tags")
    .eq("is_published", true);

  for (const row of articles || []) {
    const score = scoreArticle(q, terms, row);
    if (score <= 0) continue;
    hits.push({
      id: row.id,
      title: row.title,
      summary: row.summary || "",
      body: (row.body_md || row.summary || "").slice(0, 1200),
      source: "kb",
      score,
    });
  }

  for (const entry of searchFaqIndex(q, limit)) {
    const hay = `${entry.title} ${entry.summary} ${entry.body}`.toLowerCase();
    let score = hay.includes(q) ? 6 : 2;
    for (const t of terms) {
      if (hay.includes(t)) score += 1;
    }
    hits.push(faqToHit(entry, score));
  }

  const seen = new Set<string>();
  return hits
    .sort((a, b) => b.score - a.score)
    .filter((h) => {
      if (seen.has(h.title.toLowerCase())) return false;
      seen.add(h.title.toLowerCase());
      return true;
    })
    .slice(0, limit);
}

export function formatKbReply(hit: KbHit): string {
  const body = hit.body.replace(/^#+\s+/gm, "").trim();
  const snippet = body.length > 480 ? `${body.slice(0, 477).trim()}…` : body;
  return `${hit.title}\n\n${snippet || hit.summary}`;
}

export const ESCALATION_PROMPT =
  "Want to speak to an agent? Reply **yes** or tap the prompt below — we'll add you to the support queue.";

export const ESCALATION_ACK =
  "You're in the queue. A GLS agent will reply here as soon as possible. Typical response within one business day.";

export const NO_KB_MATCH =
  "I couldn't find a exact match in our knowledge base for that. You can rephrase your question, or reply **yes** if you'd like to speak with an agent.";

export function userWantsAgent(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /^(yes|yeah|yep|y|please|agent|human|speak to|talk to|connect me)/.test(t);
}

export function recentHasEscalationPrompt(messages: { body: string; author_type: string }[]): boolean {
  const recent = messages.slice(-4);
  return recent.some(
    (m) => m.author_type === "system" && m.body.includes("speak to an agent"),
  );
}

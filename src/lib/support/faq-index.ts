/** Searchable FAQ snippets (mirrors public /faq content as plain text). */
export type FaqHit = {
  id: string;
  title: string;
  summary: string;
  body: string;
  source: "faq";
};

export const FAQ_INDEX: FaqHit[] = [
  {
    id: "faq-trial",
    title: "Is there a free trial?",
    summary: "Up to 14 days for new accounts; one trial per device.",
    body: "Yes — up to 14 days for new accounts, limited with account, device, and network signals (one trial per device). After that, choose a 30-day plan on Plans.",
    source: "faq",
  },
  {
    id: "faq-vpn",
    title: "Why doesn't GLS include a VPN?",
    summary: "GLS is local-first streaming, not a geo-bypass tool.",
    body: "GLS is local-first streaming, not a geo-bypass tool. We do not sell, bundle, or operate a VPN to pretend you are in another country.",
    source: "faq",
  },
  {
    id: "faq-playlists",
    title: "Can I add my own playlists?",
    summary: "Members can add private M3U playlists from Account settings.",
    body: "Yes. Signed-in members can add private M3U playlists from Account settings. Playlists stay on your account and are not shared with other members.",
    source: "faq",
  },
  {
    id: "faq-payment",
    title: "How do I pay for GLS TV?",
    summary: "PayFast card, Yoco, or verified EFT on the Plans page.",
    body: "Choose a 30-day plan on Plans. We accept PayFast (card), Yoco, and verified EFT. Billing reminders appear in your account when renewal is due.",
    source: "faq",
  },
  {
    id: "faq-profiles",
    title: "What are viewer profiles?",
    summary: "Separate watch lists and continue-watching per household member.",
    body: "Viewer profiles let each person in your household keep their own continue-watching row and My List. Kids profiles can be PIN-protected.",
    source: "faq",
  },
  {
    id: "faq-support",
    title: "How do I contact support?",
    summary: "Use the chat button while signed in, or visit /support.",
    body: "Tap the chat button while signed in. We search the knowledge base first. Reply yes in the thread if you need a human agent. You can also open /support for full ticket history.",
    source: "faq",
  },
];

export function searchFaqIndex(query: string, limit = 3): FaqHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const terms = q.split(/\s+/).filter((t) => t.length > 1);
  const scored = FAQ_INDEX.map((entry) => {
    const hay = `${entry.title} ${entry.summary} ${entry.body}`.toLowerCase();
    let score = 0;
    if (hay.includes(q)) score += 8;
    for (const t of terms) {
      if (hay.includes(t)) score += 2;
    }
    return { entry, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.entry);
}

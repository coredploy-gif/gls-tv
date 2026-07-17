/**
 * Legally free Kung Fu / martial-arts starters for My Links.
 * Classic Bruce Lee / Jackie Chan / Jet Li theatrical features are NOT free to seed —
 * these are PD silents, official cultural demos, and museum explainers only.
 */
export type PublicKungFuPick = {
  title: string;
  url: string;
  category: "Kung Fu";
  whyLegal: string;
};

export const PUBLIC_KUNG_FU_PICKS: PublicKungFuPick[] = [
  {
    title:
      "Chinese Film Classics — Red Heroine (1929, Public Domain silent wuxia)",
    url: "https://www.youtube.com/watch?v=Yh-DOj0B5To",
    category: "Kung Fu",
    whyLegal:
      "1929 Shanghai silent; published by the Chinese Film Classics / Modern Chinese Cultural Studies academic channel as a public-domain early wuxia survival.",
  },
  {
    title:
      "MoMA — HOW TO SEE: Grandmaster of Kung Fu Films (Lau Kar-leung)",
    url: "https://www.youtube.com/watch?v=Gwn9633YIrQ",
    category: "Kung Fu",
    whyLegal:
      "Official Museum of Modern Art educational short about kung-fu cinema history (not a commercial feature film).",
  },
  {
    title: "CGTN — Spring Festival Gala 2019: Powerful Chinese martial arts",
    url: "https://www.youtube.com/watch?v=7x3NZmB8LFQ",
    category: "Kung Fu",
    whyLegal:
      "Official CGTN upload of a televised cultural martial-arts performance (Shaolin Tagou).",
  },
  {
    title: "New China TV — Shaolin Kung Fu show wows audience",
    url: "https://www.youtube.com/watch?v=sVB8lRoJjiM",
    category: "Kung Fu",
    whyLegal:
      "Official New China TV (Xinhua) news/culture clip of a Shaolin Temple demonstration.",
  },
  {
    title:
      "New China TV — Martial arts performance at Shaolin Temple scenic area",
    url: "https://www.youtube.com/watch?v=lvFVQPXPJ0s",
    category: "Kung Fu",
    whyLegal:
      "Official New China TV recording of a public Shaolin scenic-area martial arts performance.",
  },
];

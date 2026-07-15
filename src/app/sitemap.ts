import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://gls-tv.vercel.app").replace(/\/$/, "");
  return [
    { url: origin, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${origin}/legal`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${origin}/auth`, changeFrequency: "yearly", priority: 0.4 },
  ];
}

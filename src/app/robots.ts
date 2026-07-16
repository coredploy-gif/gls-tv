import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://gls-tv.vercel.app";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/pricing", "/legal", "/faq"],
      disallow: [
        "/admin/",
        "/api/",
        "/account/",
        "/billing/",
        "/receipts/",
        "/support/",
        "/watch/",
        "/playlists/",
        "/profiles/",
      ],
    },
    sitemap: `${origin.replace(/\/$/, "")}/sitemap.xml`,
  };
}

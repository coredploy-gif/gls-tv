import Link from "next/link";
import type { CatalogItem } from "@/data/types";
import { HeroBackdrop } from "./HeroBackdrop";
import { HeroPreview } from "./HeroPreview";

type HeroBillboardProps = {
  item: CatalogItem;
};

export function HeroBillboard({ item }: HeroBillboardProps) {
  return (
    <section className="relative h-[82vh] min-h-[560px] w-full overflow-hidden sm:h-[90vh] sm:min-h-[640px]">
      <HeroBackdrop item={item} />
      <HeroPreview item={item} />
      <div className="gls-hero-mask absolute inset-0" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_15%,rgba(10,10,10,0.5)_100%)]" />

      <div className="relative z-10 mx-auto flex h-full max-w-[1600px] flex-col justify-end px-4 pb-28 pt-28 sm:px-8 sm:pb-36 lg:px-12">
        <div className="gls-animate-in max-w-2xl">
          {item.isLive && (
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-gls-pink/30 bg-gls-pink/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-gls-pink-soft backdrop-blur-md">
              <span className="gls-live-dot h-2 w-2 rounded-full bg-gls-red" />
              Live now on GLS
            </p>
          )}
          <h1 className="gls-display text-5xl text-white drop-shadow-[0_4px_28px_rgba(0,0,0,0.75)] sm:text-6xl md:text-8xl">
            {item.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gls-body">
            {item.year && <span>{item.year}</span>}
            {item.rating && (
              <span className="rounded border border-white/30 px-1.5 py-0.5 text-xs">
                {item.rating}
              </span>
            )}
            {item.runtime && <span>{item.runtime}</span>}
            {item.seasons && <span>{item.seasons} Season</span>}
            {item.sources.some((source) => /4k|uhd|2160/i.test(source.quality || "")) && (
              <span className="gls-quality-pill">4K</span>
            )}
            <span className="text-gls-muted">
              {item.categories
                .filter(
                  (c) =>
                    ![
                      "Playable",
                      "ProxyOk",
                      "Verified",
                      "Catalog",
                      "Healed",
                      "Curated",
                    ].includes(c),
                )
                .slice(0, 3)
                .join(" · ")}
            </span>
          </div>
          <p className="mt-4 line-clamp-3 max-w-xl text-sm leading-relaxed text-gls-body sm:text-base md:text-lg">
            {item.description}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={`/watch/${item.slug}`}
              className="gls-cta inline-flex h-12 items-center gap-2 rounded px-7 text-base"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7L8 5z" />
              </svg>
              Play
            </Link>
            <Link
              href={`/watch/${item.slug}`}
              className="gls-cta-ghost inline-flex h-12 items-center gap-2 rounded px-6 text-base"
            >
              More Info
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

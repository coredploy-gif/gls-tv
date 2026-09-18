"use client";

import Link from "next/link";
import { useRef } from "react";
import type { CatalogItem } from "@/data/types";
import { TitleCard } from "./TitleCard";
import { ROW_LIMIT } from "@/lib/hubs";

type ContentRowProps = {
  title: string;
  items: CatalogItem[];
  ranked?: boolean;
  /** Cap sideways tiles; rest via View more */
  limit?: number;
  viewMoreHref?: string;
  /** Link label next to the row title (default: View more ›) */
  viewMoreLabel?: string;
  /** Show the more link even when the row is under `limit` */
  alwaysShowViewMore?: boolean;
  /** Continue watching remove */
  onRemove?: (slug: string) => void;
  /** Serializable base URL for rows rendered by a Server Component. */
  hrefPrefix?: string;
  hrefForItem?: (item: CatalogItem) => string;
};

export function ContentRow({
  title,
  items,
  ranked = false,
  limit = ROW_LIMIT,
  viewMoreHref,
  viewMoreLabel = "View more ›",
  alwaysShowViewMore = false,
  onRemove,
  hrefPrefix,
  hrefForItem,
}: ContentRowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  if (!items.length) return null;

  const visible = items.slice(0, limit);
  const remainingCount = Math.max(0, items.length - visible.length);
  const hasMore =
    Boolean(viewMoreHref) &&
    (alwaysShowViewMore || items.length > limit);

  const slide = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.85, 720);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  return (
    <section className="group/row relative z-10 mb-10 sm:mb-12">
      <div className="gls-row-heading mb-3 flex items-center justify-between gap-3 px-4 sm:px-8 lg:px-12">
        <div className="flex min-w-0 items-baseline gap-3">
          <h2 className="truncate bg-gradient-to-r from-white via-white to-gls-pink-soft/80 bg-clip-text text-lg font-semibold tracking-[-0.02em] text-transparent sm:text-xl">
            {title}
          </h2>
          {hasMore && (
            <Link
              href={viewMoreHref!}
              aria-label={`View more ${title}`}
              className="shrink-0 text-sm font-medium text-gls-pink/80 transition hover:text-gls-pink-soft"
            >
              {viewMoreLabel}
            </Link>
          )}
        </div>
        <div className="hidden shrink-0 gap-2 sm:flex">
          <button
            type="button"
            aria-label="Slide left"
            onClick={() => slide(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/45 text-gls-sky transition hover:border-gls-pink/40 hover:bg-gls-pink/10 hover:text-gls-pink-soft focus-visible:outline-offset-2"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Slide right"
            onClick={() => slide(1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/45 text-gls-sky transition hover:border-gls-pink/40 hover:bg-gls-pink/10 hover:text-gls-pink-soft focus-visible:outline-offset-2"
          >
            ›
          </button>
        </div>
      </div>

      <div className="relative">
        <button
          type="button"
          aria-label="Previous"
          onClick={() => slide(-1)}
          className="absolute left-1 top-1/2 z-20 hidden h-24 w-10 -translate-y-1/2 items-center justify-center rounded bg-black/60 text-2xl text-white opacity-0 backdrop-blur-sm transition group-hover/row:opacity-100 focus-visible:opacity-100 hover:bg-black/80 md:flex [@media(pointer:coarse)]:opacity-70"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Next"
          onClick={() => slide(1)}
          className="absolute right-1 top-1/2 z-20 hidden h-24 w-10 -translate-y-1/2 items-center justify-center rounded bg-black/60 text-2xl text-white opacity-0 backdrop-blur-sm transition group-hover/row:opacity-100 focus-visible:opacity-100 hover:bg-black/80 md:flex [@media(pointer:coarse)]:opacity-70"
        >
          ›
        </button>

        <div
          ref={scrollerRef}
          className="gls-row-scroll px-4 sm:px-8 lg:px-12"
        >
          {visible.map((item, i) => {
            const href =
              hrefForItem?.(item) ??
              (hrefPrefix
                ? `${hrefPrefix}${encodeURIComponent(item.id.replace(/^user-/, ""))}`
                : undefined);

            return (
              <div key={item.id} className="relative shrink-0">
                <TitleCard
                  item={item}
                  rank={ranked ? i + 1 : undefined}
                  href={href}
                  priority={i < 4}
                />
              {onRemove && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemove(item.slug);
                  }}
                  className="absolute right-1 top-1 z-10 rounded bg-black/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white ring-1 ring-white/20 hover:bg-gls-red"
                  title="Remove from Continue Watching"
                >
                  Remove
                </button>
              )}
              </div>
            );
          })}
          {hasMore && (
            <Link
              href={viewMoreHref!}
              aria-label={`View more ${title}`}
              className="gls-tile group/more flex aspect-[2/3] w-[46vw] shrink-0 flex-col items-center justify-center gap-3 overflow-hidden rounded-md border border-white/15 bg-[radial-gradient(circle_at_50%_35%,rgba(255,107,157,0.22),transparent_38%),linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition hover:border-gls-pink/55 sm:w-[30vw] md:w-[20vw] lg:w-[15.5vw] xl:w-[13.8vw]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/25 text-3xl transition group-hover/more:scale-110 group-hover/more:bg-white group-hover/more:text-black">›</span>
              <span>View more</span>
              {remainingCount > 0 && (
                <span className="text-xs font-normal text-gls-muted">
                  +{remainingCount} titles
                </span>
              )}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import type { CatalogItem } from "@/data/types";
import { PosterArt } from "./PosterArt";

type TitleCardProps = {
  item: CatalogItem;
  rank?: number;
  /** Override default `/watch/[slug]` (e.g. imported `/watch/mine/...`) */
  href?: string;
  /** First tiles in a hub — load HD eagerly */
  priority?: boolean;
};

/** Tile widths tuned like Netflix / Netfly — large enough for crisp Full HD posters. */
export const TITLE_CARD_WIDTH =
  "w-[46vw] sm:w-[30vw] md:w-[20vw] lg:w-[15.5vw] xl:w-[13.8vw] 2xl:w-[12.5vw]";

export function TitleCard({
  item,
  rank,
  href,
  priority = false,
}: TitleCardProps) {
  return (
    <Link
      href={href || `/watch/${item.slug}`}
      className={`gls-tile group relative block shrink-0 ${TITLE_CARD_WIDTH}`}
    >
      <div className="gls-poster-frame relative aspect-[2/3] overflow-hidden rounded-md bg-gls-elevated shadow-[0_8px_24px_rgba(0,0,0,0.55)] ring-1 ring-white/10 transition duration-300 group-hover:z-10 group-hover:scale-[1.06] group-hover:shadow-[0_16px_40px_rgba(0,0,0,0.55),0_0_28px_rgba(255,107,157,0.22)] group-hover:ring-gls-pink/45">
        <PosterArt item={item} priority={priority} />

        {item.isLive && (
          <span className="absolute left-2 top-2 z-[2] inline-flex items-center gap-1 rounded bg-gls-red px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
            <span className="gls-live-dot h-1.5 w-1.5 rounded-full bg-white" />
            Live
          </span>
        )}
        {item.categories.includes("My Playlist") && (
          <span className="absolute right-2 top-2 z-[2] rounded bg-gls-red/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Mine
          </span>
        )}
        {!item.categories.includes("My Playlist") &&
          item.categories.includes("LinearPay") && (
            <span className="absolute right-2 top-2 z-[2] rounded bg-amber-700/95 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-50">
              Linear pay
            </span>
          )}
        {!item.categories.includes("My Playlist") &&
          !item.categories.includes("LinearPay") &&
          item.categories.includes("Playable") && (
            <span className="absolute right-2 top-2 z-[2] rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Playable
            </span>
          )}
        {!item.categories.includes("My Playlist") &&
          !item.categories.includes("LinearPay") &&
          !item.categories.includes("Playable") &&
          item.categories.includes("ProxyOk") && (
            <span className="absolute right-2 top-2 z-[2] rounded bg-sky-700/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Ready
            </span>
          )}
        {!item.categories.includes("My Playlist") &&
          !item.categories.includes("LinearPay") &&
          !item.categories.includes("Playable") &&
          !item.categories.includes("ProxyOk") &&
          item.categories.includes("Verified") && (
            <span className="absolute right-2 top-2 z-[2] rounded bg-amber-600/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Available
            </span>
          )}
        {!item.categories.includes("My Playlist") &&
          !item.categories.includes("LinearPay") &&
          !item.categories.includes("Playable") &&
          !item.categories.includes("ProxyOk") &&
          !item.categories.includes("Verified") &&
          item.categories.includes("Catalog") && (
            <span className="absolute right-2 top-2 z-[2] rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/80">
              Explore
            </span>
          )}
        {rank !== undefined && (
          <span className="gls-display absolute -left-1 bottom-0 z-[2] text-[4.5rem] leading-none text-white/90 drop-shadow-[4px_0_0_#141414] sm:text-[5.5rem]">
            {rank}
          </span>
        )}
        <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
        <div className="absolute inset-x-0 bottom-0 z-[2] translate-y-2 p-2.5 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
          <p className="line-clamp-2 text-xs font-semibold text-white sm:text-sm">
            {item.title}
          </p>
          <p className="mt-0.5 text-[10px] text-gls-muted sm:text-[11px]">
            {item.categories
              .filter(
                (c) =>
                  ![
                    "Playable",
                    "ProxyOk",
                    "Verified",
                    "Catalog",
                    "Healed",
                    "IptvOrg",
                    "Unavailable",
                  ].includes(c),
              )
              .slice(0, 2)
              .join(" · ")}
          </p>
        </div>
      </div>
    </Link>
  );
}

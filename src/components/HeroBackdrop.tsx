import type { CatalogItem } from "@/data/types";
import {
  backdropSrcSet,
  cinematicBackdropPlate,
  hdBackdropUrl,
  hdPosterUrl,
  shouldUseCinematicPlate,
} from "@/lib/artwork";

type HeroBackdropProps = {
  item: CatalogItem;
};

/** Full-bleed Full HD / 4K hero image plane. */
export function HeroBackdrop({ item }: HeroBackdropProps) {
  const raw = item.backdrop || item.poster;
  const logoish = shouldUseCinematicPlate(raw, item.type);
  const src = logoish
    ? cinematicBackdropPlate(item.slug || item.id, item.categories)
    : hdBackdropUrl(raw, 3840);
  const srcSet = logoish ? undefined : backdropSrcSet(src);
  const logo = logoish ? item.logoTitle || item.poster : item.logoTitle;

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        srcSet={srcSet}
        sizes="100vw"
        alt=""
        className="gls-kenburns gls-poster-img absolute inset-0 h-full w-full object-cover"
        fetchPriority="high"
        decoding="async"
        draggable={false}
      />
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={hdPosterUrl(logo)}
          alt=""
          className="pointer-events-none absolute right-[8%] top-[28%] hidden max-h-[42vh] max-w-[28vw] object-contain opacity-90 drop-shadow-2xl lg:block"
          draggable={false}
        />
      )}
    </>
  );
}

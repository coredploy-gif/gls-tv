"use client";

import { useState } from "react";
import type { CatalogItem } from "@/data/types";
import {
  cinematicPosterPlate,
  brandedPosterFallback,
  hdPosterUrl,
  posterSrcSet,
  shouldUseCinematicPlate,
} from "@/lib/artwork";

type PosterArtProps = {
  item: CatalogItem;
  /** Eager / high priority for hero rows */
  priority?: boolean;
  className?: string;
  /** Show title footer for logo-plates when not hovering */
  alwaysShowTitle?: boolean;
};

/**
 * Netflix-style 2:3 poster — Full HD / 4K plate + logo compositing when only
 * a channel mark exists; photographic art when curated or cinematic.
 */
export function PosterArt({
  item,
  priority = false,
  className = "",
  alwaysShowTitle = false,
}: PosterArtProps) {
  const plateMode = shouldUseCinematicPlate(item.poster, item.type);
  const plate = plateMode
    ? cinematicPosterPlate(item.slug || item.id, item.categories)
    : hdPosterUrl(item.poster);
  const logo = plateMode
    ? item.logoTitle || item.poster || null
    : null;
  const showLogoOverlay = Boolean(plateMode && logo);
  const srcSet = plateMode ? undefined : posterSrcSet(plate);
  const [brokenPoster, setBrokenPoster] = useState(false);
  const [brokenLogo, setBrokenLogo] = useState(false);
  const displayPlate = brokenPoster
    ? brandedPosterFallback(item.title, item.categories)
    : plate;
  const showTitleFooter = plateMode || brokenPoster;

  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-gls-elevated ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={displayPlate}
        srcSet={brokenPoster ? undefined : srcSet}
        sizes="(max-width: 640px) 46vw, (max-width: 1024px) 22vw, 15vw"
        alt=""
        className="gls-poster-img absolute inset-0 h-full w-full object-cover"
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onError={() => setBrokenPoster(true)}
        draggable={false}
      />

      {(showLogoOverlay || showTitleFooter) && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/20" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.1),rgba(0,0,0,0.55))]" />
          {showLogoOverlay && logo && !brokenLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt=""
              className="absolute left-1/2 top-[40%] z-[1] max-h-[42%] max-w-[68%] -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.85)]"
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              onError={() => setBrokenLogo(true)}
              draggable={false}
            />
          )}
          <div
            className={`absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-black/95 via-black/50 to-transparent px-2.5 pb-2.5 pt-10 ${
              alwaysShowTitle
                ? "opacity-100"
                : "opacity-90 transition group-hover:opacity-100"
            }`}
          >
            {showTitleFooter && (
              <p className="line-clamp-2 text-center text-[11px] font-bold leading-tight text-white sm:text-xs">
                {item.title}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

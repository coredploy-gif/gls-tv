"use client";

import { useEffect, useRef, useState } from "react";
import type { CatalogItem } from "@/data/types";
import type HlsType from "hls.js";

type HeroPreviewProps = {
  item: CatalogItem;
};

function primaryHlsUrl(item: CatalogItem): string | null {
  const source = [...(item.sources || [])]
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
    .find((s) => s.format === "hls" || s.url.includes(".m3u8"));
  return source?.url ?? null;
}

/** Muted Netflix-style billboard preview — Play still goes to the full watch page. */
export function HeroPreview({ item }: HeroPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HlsType | null>(null);
  const [ready, setReady] = useState(false);
  const url = primaryHlsUrl(item);

  useEffect(() => {
    if (!url) return;

    const el = videoRef.current;
    if (!el) return;

    let cancelled = false;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    const onPlaying = () => {
      if (!cancelled) setReady(true);
    };
    el.addEventListener("playing", onPlaying);

    const cleanup = () => {
      el.removeEventListener("playing", onPlaying);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      el.removeAttribute("src");
      el.load();
    };

    const start = async () => {
      try {
        if (el.canPlayType("application/vnd.apple.mpegurl")) {
          el.src = url;
          await el.play().catch(() => undefined);
          return;
        }

        const Hls = (await import("hls.js")).default;
        if (cancelled || !Hls.isSupported()) return;

        const instance = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          maxBufferLength: 8,
          maxMaxBufferLength: 12,
          startLevel: -1,
        });
        hlsRef.current = instance;
        instance.loadSource(url);
        instance.attachMedia(el);
        instance.on(Hls.Events.MANIFEST_PARSED, () => {
          void el.play().catch(() => undefined);
        });
      } catch {
        // Keep static backdrop if preview cannot start.
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          if (!hlsRef.current && !el.src) void start();
          else void el.play().catch(() => undefined);
        } else {
          el.pause();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);

    return () => {
      cancelled = true;
      io.disconnect();
      cleanup();
      setReady(false);
    };
  }, [url]);

  if (!url) return null;

  return (
    <video
      ref={videoRef}
      className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
        ready ? "opacity-100" : "opacity-0"
      }`}
      muted
      autoPlay
      playsInline
      loop={!item.isLive}
      preload="auto"
      aria-hidden
    />
  );
}

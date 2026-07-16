"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { CatalogItem, MediaSource } from "@/data/types";
import type HlsType from "hls.js";
import {
  clearStreamMemory,
  getStreamMemory,
  rememberStream,
} from "@/lib/stream-memory";
import { isLinearSportsPack } from "@/lib/sports-packs";
import {
  isFragileHost,
  isGeoSensitiveChannel,
  isPlutoFamily,
  needsDeepBuffer,
} from "@/lib/channel-heal";
import { isBrokenTraceOrigin, isTraceChannel } from "@/lib/trace-mirrors";
import { isLinearPayCategory } from "@/lib/linear-pay";

type VideoPlayerProps = {
  item: CatalogItem;
};

type HlsCtor = typeof import("hls.js").default;

function toProxiedHls(url: string) {
  if (url.startsWith("/api/hls")) return url;
  return `/api/hls?url=${encodeURIComponent(url)}`;
}

/** Cleartext HLS cannot load on an https:// app without the proxy. */
function requiresProxy(url: string) {
  return /^http:\/\//i.test(url);
}

/**
 * HTTPS hosts that still need /api/hls in the browser:
 * jmp2.uk redirects into Pluto stitcher with relative paths + no CORS.
 * Trace+ / some sticky CDNs need proxy Referer when used as last resort.
 * Never force proxy for hard-geo SABC — handled separately.
 */
function prefersProxy(url: string) {
  // ZA geo CDNs must hit the viewer IP — never force our edge proxy.
  if (/mangomolo\.com|sabcplus/i.test(url)) return false;
  if (requiresProxy(url)) return true;
  if (isBrokenTraceOrigin(url) || isFragileHost(url)) return true;
  if (isPlutoFamily(url)) return true;
  return false;
}

function sortedSources(item: CatalogItem): MediaSource[] {
  const list = [...(item.sources || [])];
  // Seeded / numbered linear packs + Trace: keep server order (healed mirrors first).
  if (
    item.categories.includes("UserSeed") ||
    item.categories.includes("LinearSports") ||
    item.categories.includes("Healed") ||
    isLinearSportsPack(item) ||
    isTraceChannel(item.slug, item.title)
  ) {
    return list;
  }
  return list.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
}

/** Hard geo CDNs (SABC family) — browser IP unlocks; server proxy usually makes it worse. */
function isHardGeo(item: CatalogItem) {
  return (
    item.categories.includes("Geo") ||
    isGeoSensitiveChannel(item.slug, item.title, item.categories) ||
    /sabc-?\d|sabc-news|sabcnews/i.test(item.slug)
  );
}

/** Sports / Trace / healed live need deeper ahead buffer. */
function isSportsHeavy(item: CatalogItem) {
  return (
    needsDeepBuffer(item) ||
    isLinearSportsPack(item) ||
    isTraceChannel(item.slug, item.title) ||
    item.categories.includes("LinearSports") ||
    item.categories.some((c) =>
      /sport|soccer|football|wrestling|racing|music|trace|healed|news/i.test(c),
    ) ||
    /sport|tsn|fox|espn|bein|soccer|football|racing|trace|sabc|ln24/i.test(
      item.slug,
    )
  );
}

/** Flaky HTTPS hosts — degrade bitrate; Trace+/junk last. */
function isUnstableCdn(url: string) {
  return (
    isFragileHost(url) ||
    isBrokenTraceOrigin(url) ||
    isPlutoFamily(url) ||
    /streamvidex|qzz\.io|\/\d+\.\d+\.\d+\.\d+|amagi\.tv|playouts\.now\.amagi|mangomolo|bozztv|freevision/i.test(
      url,
    )
  );
}

function initialPick(item: CatalogItem, sources: MediaSource[]) {
  const mem = getStreamMemory(item.slug);
  const hardGeo = isHardGeo(item);
  const first = sources[0];
  const seededLinear =
    item.categories.includes("UserSeed") ||
    item.categories.includes("LinearSports") ||
    isLinearSportsPack(item);

  // A previous relay fallback must not permanently pin an owner-scoped
  // playlist channel to the server path. Start each later visit like VLC:
  // original source from the viewer device first.
  if (
    first?.label === "browser-direct" &&
    (mem?.url !== first.url || mem.mode !== "direct")
  ) {
    clearStreamMemory(item.slug);
  }

  // Drop poisoned proxy memory that left SABC 3 flashing "Mirror 1 · proxy…"
  if (hardGeo && mem?.mode === "proxy") {
    clearStreamMemory(item.slug);
  }

  // Drop Ocho / wrong-CDN memory on seeded TSN/Fox so seed (VLC URL) wins
  if (
    seededLinear &&
    mem?.url &&
    first &&
    mem.url !== first.url &&
    /ocho|livenow|cloudfront\.net\/.*Ocho|ESPNTheOcho/i.test(mem.url)
  ) {
    clearStreamMemory(item.slug);
  }

  // Drop dead Trace+ CDN memory so Amagi heal mirrors win
  if (
    isTraceChannel(item.slug, item.title) &&
    mem?.url &&
    isBrokenTraceOrigin(mem.url)
  ) {
    clearStreamMemory(item.slug);
  }

  const memNow = getStreamMemory(item.slug);

  if (!memNow?.url || (hardGeo && memNow.mode === "proxy")) {
    // Imported playlists try the original source first, followed by the
    // authenticated relay and any same-title mirrors.
    if (first?.label === "browser-direct") {
      return { index: 0, mode: "direct" as const };
    }
    if (first && prefersProxy(first.url) && !hardGeo) {
      return { index: 0, mode: "proxy" as const };
    }
    return { index: 0, mode: "direct" as const };
  }

  // Seeded linear / Trace heals: always start on source 0 (Amagi / eadmin),
  // ignore stale memory that could pin a dead Trace+ CDN.
  const preferFirst =
    seededLinear ||
    item.categories.includes("Healed") ||
    isTraceChannel(item.slug, item.title);
  if (preferFirst && first) {
    return {
      index: 0,
      mode: prefersProxy(first.url) && !hardGeo ? ("proxy" as const) : ("direct" as const),
    };
  }

  const idx = sources.findIndex((s) => s.url === memNow.url);
  if (idx < 0) {
    if (first && prefersProxy(first.url) && !hardGeo) {
      return { index: 0, mode: "proxy" as const };
    }
    return { index: 0, mode: "direct" as const };
  }

  // Hard geo always starts direct (viewer ZA IP). Never revive proxy.
  if (hardGeo) {
    return { index: idx, mode: "direct" as const };
  }

  // HTTP / Pluto-via-jmp2 must stay on proxy; other HTTPS can use memory
  if (prefersProxy(sources[idx].url)) {
    return { index: idx, mode: "proxy" as const };
  }

  return { index: idx, mode: memNow.mode };
}

function bufferedAhead(el: HTMLVideoElement): number {
  const { buffered, currentTime } = el;
  if (!buffered.length) return 0;
  for (let i = 0; i < buffered.length; i++) {
    if (currentTime >= buffered.start(i) && currentTime <= buffered.end(i)) {
      return Math.max(0, buffered.end(i) - currentTime);
    }
  }
  const end = buffered.end(buffered.length - 1);
  return end > currentTime ? end - currentTime : 0;
}

function playUrlFor(source: MediaSource, mode: "direct" | "proxy") {
  if (source.format !== "hls") return source.url;
  return mode === "proxy" ? toProxiedHls(source.url) : source.url;
}

/**
 * YouTube-style live player:
 * - fast start (low ABR + short buffer) then deepen ahead buffer
 * - silent recover / proxy / mirror (no black-out panic)
 * - standby warmup of next mirror
 * - last-good mirror memory + wake lock + media session
 * - pause keeps playhead; buffer keeps filling; Back to live on demand
 */
export function VideoPlayer({ item }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HlsType | null>(null);
  const standbyRef = useRef<HlsType | null>(null);
  const behindLiveRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const deepBufferRef = useRef(false);

  const sources = useMemo(() => sortedSources(item), [item]);
  const privatePlaylist = item.categories.includes("My Playlist");

  const [sourceIndex, setSourceIndex] = useState(0);
  const [mode, setMode] = useState<"direct" | "proxy">("direct");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Starting…");
  const [behindLive, setBehindLive] = useState(false);
  const [lagSec, setLagSec] = useState(0);
  const [aheadSec, setAheadSec] = useState(0);

  const source = sources[sourceIndex];

  useEffect(() => {
    const next = initialPick(item, sortedSources(item));
    queueMicrotask(() => {
      setSourceIndex(next.index);
      setMode(isHardGeo(item) ? "direct" : next.mode);
      setBehindLive(false);
      behindLiveRef.current = false;
      setAheadSec(0);
      setError(null);
      deepBufferRef.current = false;
    });
  }, [item.id, item.slug]);

  useEffect(() => {
    behindLiveRef.current = behindLive;
  }, [behindLive]);

  // Wake Lock — keep screen on while watching
  useEffect(() => {
    let released = false;
    async function requestLock() {
      try {
        if (!("wakeLock" in navigator)) return;
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      } catch {
        /* unsupported / denied */
      }
    }
    void requestLock();
    const onVis = () => {
      if (document.visibilityState === "visible" && !released) void requestLock();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVis);
      void wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, [item.id]);

  // Media Session (lock-screen controls)
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: item.title,
        artist: "GLS TV",
        album: item.isLive ? "Live" : "On demand",
        artwork: item.poster
          ? [{ src: item.poster, sizes: "512x512", type: "image/png" }]
          : [],
      });
      navigator.mediaSession.setActionHandler("play", () => {
        void videoRef.current?.play();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        videoRef.current?.pause();
      });
    } catch {
      /* ignore */
    }
  }, [item.title, item.poster, item.isLive]);

  // Warm next mirror in background (manifest only)
  useEffect(() => {
    let cancelled = false;
    const next = sources[sourceIndex + 1];
    standbyRef.current?.destroy();
    standbyRef.current = null;
    if (!next || next.format !== "hls") return;

    (async () => {
      try {
        const Hls = (await import("hls.js")).default;
        if (cancelled || !Hls.isSupported()) return;
        const warm = new Hls({
          enableWorker: true,
          autoStartLoad: false,
          maxBufferLength: 8,
          maxMaxBufferLength: 12,
          startLevel: 0,
        });
        warm.loadSource(next.url);
        warm.on(Hls.Events.MANIFEST_PARSED, () => {
          /* warmed — ready for fast cutover */
        });
        standbyRef.current = warm;
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
      standbyRef.current?.destroy();
      standbyRef.current = null;
    };
  }, [sources, sourceIndex, item.id]);

  useEffect(() => {
    if (!source) return;

    let cancelled = false;
    let waitingTimer: ReturnType<typeof setTimeout> | null = null;
    let startWatchdog: ReturnType<typeof setTimeout> | null = null;
    let lagTimer: ReturnType<typeof setInterval> | null = null;
    let deepenTimer: ReturnType<typeof setTimeout> | null = null;
    let recoverCount = 0;
    let switchedToProxy = false;
    let switchedToDirect = false;
    let mirrorsAdvanced = 0;
    let remembered = false;
    let gotManifest = false;
    let detachMedia: (() => void) | undefined;
    const hardGeo = isHardGeo(item);

    const clearWaiting = () => {
      if (waitingTimer) {
        clearTimeout(waitingTimer);
        waitingTimer = null;
      }
    };

    const clearWatchdog = () => {
      if (startWatchdog) {
        clearTimeout(startWatchdog);
        startWatchdog = null;
      }
    };

    const markBehind = () => {
      behindLiveRef.current = true;
      setBehindLive(true);
    };

    const saveGood = () => {
      if (remembered || !source) return;
      // Never poison hard-geo memory with proxy — it sticks SABC 3 on proxy…
      if (hardGeo && mode === "proxy") return;
      remembered = true;
      rememberStream(item.slug, source.url, mode);
    };

    const deepenBuffer = (instance: HlsType) => {
      if (deepBufferRef.current) return;
      deepBufferRef.current = true;
      try {
        const linear = isLinearSportsPack(item);
        const sports = isSportsHeavy(item);
        const trace = isTraceChannel(item.slug, item.title);
        const privatePlaylist = item.categories.includes("My Playlist");
        // Keep a substantial reserve for long-form live / Trace music.
        instance.config.maxBufferLength =
          privatePlaylist ? 60 : linear || trace ? 420 : sports ? 320 : 140;
        instance.config.maxMaxBufferLength =
          privatePlaylist ? 180 : linear || trace ? 720 : sports ? 540 : 280;
        instance.config.maxBufferSize =
          (privatePlaylist
            ? 90
            : linear || trace
              ? 380
              : sports
                ? 280
                : 120) *
          1000 *
          1000;
        instance.startLoad(-1);
      } catch {
        /* ignore */
      }
    };

    async function setup() {
      const el = videoRef.current;
      if (!el || !source) return;
      setError(null);
      setStatus(
        "Getting ready…",
      );
      recoverCount = 0;
      remembered = false;
      deepBufferRef.current = false;

      // Soft swap — keep element mounted; clear old media
      hlsRef.current?.destroy();
      hlsRef.current = null;
      el.removeAttribute("src");
      el.load();

      if (source.format !== "hls") {
        const onNativeError = () => {
          if (cancelled) return;
          if (sourceIndex + 1 < sources.length) {
            setStatus("Trying another source…");
            setMode("direct");
            setSourceIndex((index) => index + 1);
            return;
          }
          setError("This channel is not available to play right now.");
        };
        el.addEventListener("error", onNativeError);
        detachMedia = () => el.removeEventListener("error", onNativeError);
        el.src = source.url;
        setStatus("Playing");
        try {
          await el.play();
          saveGood();
        } catch {
          setStatus("Tap play to start");
        }
        return;
      }

      const url = playUrlFor(source, mode);

      try {
        const Hls = (await import("hls.js")).default as HlsCtor;
        if (cancelled) return;

        if (!Hls.isSupported()) {
          if (el.canPlayType("application/vnd.apple.mpegurl")) {
            el.src = url;
            setStatus(item.isLive ? "Live" : "Ready");
            void el
              .play()
              .then(() => saveGood())
              .catch(() => setStatus("Tap play to start"));
            return;
          }
          setError("Playback is not supported on this device.");
          return;
        }

        // Fast start: low tier + short buffer, then deepen after playing.
        // Linear sports + Trace: deep reserve against CDN / Wi-Fi jitter.
        const linear = isLinearSportsPack(item);
        const sports = isSportsHeavy(item);
        const trace = isTraceChannel(item.slug, item.title);
        const privatePlaylist = item.categories.includes("My Playlist");
        const unstable = isUnstableCdn(url) || requiresProxy(url) || trace;
        const deepLive =
          linear || sports || unstable || trace || privatePlaylist;
        const instance = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          startFragPrefetch: true,
          testBandwidth: !unstable && !linear && !trace,
          startLevel: 0,
          abrEwmaDefaultEstimate:
            deepLive ? 350_000 : 800_000,
          abrBandWidthFactor: deepLive ? 0.5 : 0.8,
          abrBandWidthUpFactor: deepLive ? 0.3 : 0.6,
          // Stay further behind live edge so the buffer can fill deeply.
          liveSyncDurationCount: linear || trace ? 32 : unstable ? 22 : sports ? 20 : 6,
          liveMaxLatencyDurationCount:
            linear || trace ? 260 : unstable ? 180 : sports ? 160 : 50,
          liveDurationInfinity: true,
          // Private playlists may preload up to at least 60 seconds when the
          // upstream live window and available bandwidth permit it.
          maxBufferLength:
            privatePlaylist
              ? 60
              : linear || trace
                ? 200
                : unstable
                  ? 140
                  : sports
                    ? 120
                    : 30,
          maxMaxBufferLength:
            privatePlaylist
              ? 180
              : linear || trace
                ? 480
                : unstable
                  ? 320
                  : sports
                    ? 280
                    : 90,
          maxBufferSize:
            (privatePlaylist
              ? 90
              : linear || trace
                ? 220
                : unstable
                  ? 160
                  : sports
                    ? 130
                    : 40) *
            1000 *
            1000,
          maxBufferHole: deepLive ? 1.8 : 0.5,
          backBufferLength: linear || trace ? 300 : sports || unstable ? 210 : 75,
          highBufferWatchdogPeriod: 2,
          nudgeMaxRetry: 24,
          manifestLoadingTimeOut: deepLive ? 45000 : 18000,
          levelLoadingTimeOut: deepLive ? 45000 : 18000,
          fragLoadingTimeOut: deepLive ? 60000 : 22000,
          xhrSetup: (xhr) => {
            // Imported playlists run through our same-origin relay. It needs
            // the signed-in viewer session cookie; direct public HLS sources
            // deliberately remain credential-free.
            xhr.withCredentials = url.startsWith("/api/");
          },
        });

        hlsRef.current = instance;
        instance.loadSource(url);
        instance.attachMedia(el);

        const jumpToLive = () => {
          const live = instance.liveSyncPosition;
          if (live != null && Number.isFinite(live)) {
            try {
              el.currentTime = live;
            } catch {
              /* ignore */
            }
            behindLiveRef.current = false;
            setBehindLive(false);
            setLagSec(0);
            void el.play().catch(() => undefined);
          } else {
            instance.startLoad();
          }
        };

        (el as HTMLVideoElement & { __glsJumpLive?: () => void }).__glsJumpLive =
          jumpToLive;

        const silentProxy = () => {
          // The direct source in an imported playlist has a dedicated relay
          // source immediately after it. Skip straight to that source rather
          // than wrapping the arbitrary URL in the catalogue-only proxy path.
          if (source.label === "browser-direct") return silentMirror();
          // This source is already the authenticated relay. Changing only the
          // mode recreates the same URL and causes an endless HLS restart.
          if (
            source.label === "secure-relay" ||
            source.url.startsWith("/api/hls")
          ) {
            return false;
          }
          // Regional restrictions are never retried through the server proxy.
          // That path only exists for browser/CORS compatibility.
          if (hardGeo) return false;
          if (cancelled || mode === "proxy" || switchedToProxy) return false;
          switchedToProxy = true;
          setStatus("Reconnecting…");
          setMode("proxy");
          return true;
        };

        const silentDirect = () => {
          if (cancelled || mode === "direct" || switchedToDirect) return false;
          if (
            source.label === "secure-relay" ||
            source.url.startsWith("/api/hls")
          ) {
            return false;
          }
          // Never flip cleartext HTTP / Pluto-jmp2 off proxy
          if (source && prefersProxy(source.url)) return false;
          switchedToDirect = true;
          setStatus("Trying again…");
          setMode("direct");
          return true;
        };

        const silentMirror = () => {
          if (cancelled) return false;
          if (sourceIndex + 1 >= sources.length) return false;
          if (mirrorsAdvanced >= sources.length - 1) return false;
          mirrorsAdvanced += 1;
          const nextSrc = sources[sourceIndex + 1];
          setStatus("Trying another source…");
          setMode(
            nextSrc && prefersProxy(nextSrc.url) && !hardGeo
              ? "proxy"
              : "direct",
          );
          setSourceIndex((i) => i + 1);
          return true;
        };

        const failOverPath = () => {
          // Geo: skip proxy thrash — step mirrors on direct only
          if (hardGeo) {
            if (mode === "proxy" && silentDirect()) return true;
            return silentMirror();
          }
          if (mode === "proxy" && silentDirect()) return true;
          if (mode === "direct" && silentProxy()) return true;
          return silentMirror();
        };

        // If manifest never arrives, flip path (faster on hard geo).
        startWatchdog = setTimeout(
          () => {
            if (cancelled || gotManifest) return;
            setStatus("Finding the best available stream…");
            if (!failOverPath()) {
              setError(
                hardGeo
                  ? "This channel is unavailable in this region. Try SABC News or LN24."
                  : "This programme isn’t available right now. Please try another channel.",
              );
            }
          },
          hardGeo ? 6000 : 10000,
        );

        instance.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
          gotManifest = true;
          clearWatchdog();
          // Prefer a mid-safe start if many levels; still start low when uncertain
          try {
            if (data.levels?.length > 2) {
              instance.startLevel = Math.min(1, data.levels.length - 1);
            }
          } catch {
            /* ignore */
          }
          setStatus(item.isLive ? "Live" : "Ready");
          void el
            .play()
            .then(() => {
              saveGood();
              deepenTimer = setTimeout(
                () => deepenBuffer(instance),
                isLinearSportsPack(item) ||
                  isSportsHeavy(item) ||
                  isTraceChannel(item.slug, item.title) ||
                  item.categories.includes("My Playlist")
                  ? 500
                  : 2500,
              );
            })
            .catch(() => setStatus("Tap play to start"));
        });

        instance.on(Hls.Events.FRAG_BUFFERED, () => {
          const ahead = bufferedAhead(el);
          setAheadSec(Math.round(ahead));
          if (ahead >= 6) {
            saveGood();
            deepenBuffer(instance);
          }
        });

        instance.on(Hls.Events.LEVEL_SWITCHED, () => {
          // After ABR climbs, push deeper buffer
          if (el.readyState >= 3) deepenBuffer(instance);
        });

        instance.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) {
            // Silent non-fatal recover — never flash error overlay
            if (
              !behindLiveRef.current &&
              (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR ||
                data.details === Hls.ErrorDetails.BUFFER_SEEK_OVER_HOLE)
            ) {
              setStatus(isSportsHeavy(item) ? "Optimising playback…" : "Getting things ready…");
              if (isSportsHeavy(item)) {
                // Don't yo-yo to live edge on sports — refill while slightly behind
                try {
                  instance.startLoad();
                } catch {
                  /* ignore */
                }
              } else {
                jumpToLive();
              }
            }
            return;
          }

          const responseCode = data.response?.code;
          if (responseCode === 401 || responseCode === 409) {
            setError("Choose your viewer profile to start watching.");
            return;
          }
          if (responseCode === 403) {
            setError("This channel is not available to play right now.");
            return;
          }

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setStatus("Reconnecting…");
            if (failOverPath()) return;
            recoverCount += 1;
            if (recoverCount > 5) {
              setError("This programme isn’t available right now. Please try another channel.");
              return;
            }
            try {
              instance.startLoad();
            } catch {
              /* ignore */
            }
            return;
          }

          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            setStatus("Recovering…");
            recoverCount += 1;
            if (recoverCount > 5) {
              if (failOverPath()) return;
              setError("Playback has stopped. Please try another channel.");
              return;
            }
            try {
              instance.recoverMediaError();
            } catch {
              /* ignore */
            }
            if (!behindLiveRef.current) jumpToLive();
            return;
          }

          if (failOverPath()) return;
          setError("This programme isn’t available right now. Please try another channel.");
        });

        const onPause = () => {
          if (!item.isLive) return;
          markBehind();
          try {
            instance.startLoad();
          } catch {
            /* ignore */
          }
          setStatus("Paused");
        };

        const onPlay = () => {
          if (behindLiveRef.current) setStatus("Playing · behind live");
        };

        const onWaiting = () => {
          // Soft status only — don't panic-overlay while buffer refills
          setStatus("Buffering…");
          clearWaiting();
          const sports = isSportsHeavy(item) || isLinearSportsPack(item);
          waitingTimer = setTimeout(() => {
            if (cancelled || el.readyState >= 3) return;
            if (!gotManifest && failOverPath()) return;
            recoverCount += 1;
            if (recoverCount > (sports ? 6 : 4)) {
              if (failOverPath()) return;
              setError("This stream is taking longer than usual. Please try another channel.");
              return;
            }
            if (behindLiveRef.current || sports) {
              setStatus("Getting things ready…");
              try {
                instance.startLoad();
              } catch {
                /* ignore */
              }
              return;
            }
            setStatus("Resuming playback…");
            jumpToLive();
          }, sports ? 10000 : 6000);
        };

        const onPlaying = () => {
          clearWaiting();
          clearWatchdog();
          gotManifest = true;
          recoverCount = 0;
          saveGood();
          deepenBuffer(instance);
          setAheadSec(Math.round(bufferedAhead(el)));
          if (item.isLive && behindLiveRef.current) {
            setStatus("Behind live");
          } else {
            setStatus(item.isLive ? "Live" : "Playing");
          }
        };

        lagTimer = setInterval(() => {
          if (cancelled) return;
          setAheadSec(Math.round(bufferedAhead(el)));
          if (!item.isLive) return;
          const live = instance.liveSyncPosition;
          if (live == null || !Number.isFinite(live)) return;
          const lag = Math.max(0, Math.round(live - el.currentTime));
          setLagSec(lag);
          if (lag > 8) markBehind();
          else if (lag <= 3 && !el.paused) {
            behindLiveRef.current = false;
            setBehindLive(false);
          }
        }, 1500);

        el.addEventListener("waiting", onWaiting);
        el.addEventListener("playing", onPlaying);
        el.addEventListener("pause", onPause);
        el.addEventListener("play", onPlay);

        detachMedia = () => {
          el.removeEventListener("waiting", onWaiting);
          el.removeEventListener("playing", onPlaying);
          el.removeEventListener("pause", onPause);
          el.removeEventListener("play", onPlay);
          delete (el as HTMLVideoElement & { __glsJumpLive?: () => void })
            .__glsJumpLive;
        };
      } catch (err) {
        console.error(err);
        if (
          source.label === "browser-direct" &&
          sourceIndex + 1 < sources.length
        ) {
          setSourceIndex((i) => i + 1);
          setMode("direct");
          return;
        }
        if (
          source.label === "secure-relay" ||
          source.url.startsWith("/api/hls")
        ) {
          setError("This stream could not start in the browser.");
          return;
        }
        if (mode === "proxy") {
          setMode("direct");
          return;
        }
        if (!hardGeo && mode === "direct" && !switchedToProxy) {
          switchedToProxy = true;
          setMode("proxy");
          return;
        }
        if (sourceIndex + 1 < sources.length) {
          setSourceIndex((i) => i + 1);
          setMode("direct");
          return;
        }
        setError(
          hardGeo
            ? "This channel isn’t available in your region. Try SABC News or LN24."
            : "We can’t start this programme right now. Please try another channel.",
        );
      }
    }

    void setup();

    return () => {
      cancelled = true;
      clearWaiting();
      clearWatchdog();
      if (lagTimer) clearInterval(lagTimer);
      if (deepenTimer) clearTimeout(deepenTimer);
      detachMedia?.();
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [
    source,
    item.isLive,
    item.id,
    item.slug,
    mode,
    sourceIndex,
    sources.length,
  ]);

  const goLive = () => {
    const el = videoRef.current as HTMLVideoElement & {
      __glsJumpLive?: () => void;
    };
    el?.__glsJumpLive?.();
    setStatus("Live");
  };

  if (!sources.length) {
    const linearPay = isLinearPayCategory(item.categories);
    return (
      <div className="relative flex aspect-video w-full flex-col items-center justify-center gap-3 bg-black p-6 text-center">
        <p className="rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100">
          {linearPay
            ? "Linear pay channel · official subscription required"
            : "Technically offline"}
        </p>
        <p className="text-lg font-semibold text-white">
          {linearPay
            ? `${item.title} needs an official subscription`
            : "This channel is not available right now"}
        </p>
        <p className="max-w-lg text-sm text-white/70">
          {linearPay
            ? "Use the official licensed provider available in your territory."
            : "Please choose another channel and try again later."}
        </p>
        {linearPay && (
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Link
              href="/sports"
              className="rounded border border-white/15 px-4 py-2 text-sm text-gls-muted hover:text-white"
            >
              Browse Sports
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        className="h-full w-full bg-black"
        controls
        autoPlay
        playsInline
        preload="auto"
      />

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 p-6 text-center">
          <p className="text-lg font-semibold text-white">{error}</p>
          {(isHardGeo(item) || /geo|region|south africa/i.test(error)) && (
            <p className="max-w-md text-sm text-white/70">
              This channel may be subject to regional or rights restrictions.
              Try one of the available news alternatives below.
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            {/choose your viewer profile/i.test(error) && (
              <Link
                href="/profiles"
                className="gls-cta rounded px-4 py-2 text-sm"
              >
                Choose profile
              </Link>
            )}
            {isHardGeo(item) && (
              <>
                <Link
                  href="/watch/sabc-news"
                  className="gls-cta rounded px-4 py-2 text-sm"
                >
                  SABC News
                </Link>
                <Link
                  href="/watch/ln24-sa"
                  className="rounded border border-white/20 px-4 py-2 text-sm text-white"
                >
                  LN24
                </Link>
              </>
            )}
            {sourceIndex + 1 < sources.length && (
              <button
                type="button"
                className="gls-cta rounded px-4 py-2 text-sm"
                onClick={() => {
                  setError(null);
                  setMode("direct");
                  setSourceIndex((i) => i + 1);
                }}
              >
                Try another option
              </button>
            )}
            {!isHardGeo(item) && (
              <button
                type="button"
                className="rounded border border-white/20 px-4 py-2 text-sm text-white"
                onClick={() => {
                  setError(null);
                  setMode((m) => (m === "direct" ? "proxy" : "direct"));
                }}
              >
                Try again
              </button>
            )}
          </div>
        </div>
      )}

      {!error && (
        <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
          {/buffer|starting|reconnect|recover|smooth|switch/i.test(status) && (
            <span className="gls-buffer-ring !h-7 !w-7 border-2" aria-hidden />
          )}
          <span className="inline-flex items-center gap-1.5 rounded bg-black/70 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-white ring-1 ring-white/15">
            {item.isLive && !behindLive && (
              <span className="gls-live-dot h-1.5 w-1.5 rounded-full bg-gls-red" />
            )}
            {status}
            {(privatePlaylist || aheadSec >= 5) && (
              <span className="normal-case tracking-normal text-emerald-300/90">
                · {aheadSec}s
                {privatePlaylist ? " / 60s buffer target" : " ahead"}
              </span>
            )}
            {item.categories.includes("Geo") && (
              <span className="normal-case tracking-normal text-amber-200/80">
                · regional availability
              </span>
            )}
          </span>
          {item.isLive && behindLive && (
            <button
              type="button"
              onClick={goLive}
              className="rounded bg-gls-red px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-lg transition hover:brightness-110"
            >
              Back to live
              {lagSec > 0 ? ` · ${lagSec}s` : ""}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import {
  absoluteStreamUrl,
  castFeedbackForResult,
  castLikelyWorks,
  promptCastOrAirPlay,
  shouldShowCastControl,
} from "@/lib/remote-playback";
import {
  clampSeekTime,
  getSeekableWindow,
  seekBySeconds,
} from "@/lib/live-playback-policy";

const IDLE_MS = 2800;
/** Ignore sub-second HLS stalls so live edge waits don't pin chrome open. */
const BUFFER_SHOW_MS = 500;
/** Keep Cast guidance visible long enough to read / copy. */
const CAST_HINT_MS = 12000;
const SKIP_SEC = 10;

export type ChromeNeighbor = {
  href: string;
  title: string;
};

type PlayerChromeProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  isLive?: boolean;
  title?: string;
  /** Current source format — gates Cast/AirPlay. */
  format?: string;
  /**
   * Fetchable stream URL for Cast fallbacks (not the blob: MSE src).
   * Used for “Copy stream link” when Remote Playback can’t send MSE.
   */
  castUrl?: string | null;
  /** When true, force chrome visible (rare explicit overrides). */
  forceVisible?: boolean;
  prevChannel?: ChromeNeighbor | null;
  nextChannel?: ChromeNeighbor | null;
  /** Called when the user rewinds / scrubs live DVR (stay behind live). */
  onUserSeekLive?: () => void;
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function listCaptionTracks(el: HTMLVideoElement): TextTrack[] {
  const out: TextTrack[] = [];
  const list = el.textTracks;
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (!t) continue;
    if (t.kind === "subtitles" || t.kind === "captions") out.push(t);
  }
  return out;
}

export function PlayerChrome({
  videoRef,
  isLive = false,
  title,
  format,
  castUrl = null,
  forceVisible = false,
  prevChannel = null,
  nextChannel = null,
  onUserSeekLive,
}: PlayerChromeProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekMin, setSeekMin] = useState(0);
  const [seekMax, setSeekMax] = useState(0);
  const [isFs, setIsFs] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [hasCaptions, setHasCaptions] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [castHint, setCastHint] = useState<string | null>(null);
  const [castCopyUrl, setCastCopyUrl] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [canCast, setCanCast] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bufferTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const castHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const forceVisibleRef = useRef(forceVisible);
  const bufferingRef = useRef(false);
  const castHintRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const lastVolRef = useRef(1);

  forceVisibleRef.current = forceVisible;
  bufferingRef.current = buffering;
  castHintRef.current = Boolean(castHint);

  const clearIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
  }, []);

  const clearBufferTimer = useCallback(() => {
    if (bufferTimer.current) clearTimeout(bufferTimer.current);
    bufferTimer.current = null;
  }, []);

  const clearCastHintTimer = useCallback(() => {
    if (castHintTimer.current) clearTimeout(castHintTimer.current);
    castHintTimer.current = null;
  }, []);

  const showCastFeedback = useCallback(
    (message: string, copy?: string | null) => {
      setCastHint(message);
      setCastCopyUrl(copy ?? null);
      setCopyStatus("idle");
      clearCastHintTimer();
      setVisible(true);
      clearIdle();
      castHintRef.current = true;
      castHintTimer.current = setTimeout(() => {
        setCastHint(null);
        setCastCopyUrl(null);
        setCopyStatus("idle");
        castHintRef.current = false;
        const el = videoRef.current;
        const playing = Boolean(el && !el.paused && !el.ended);
        if (playing && !forceVisibleRef.current && !bufferingRef.current) {
          idleTimer.current = setTimeout(() => setVisible(false), IDLE_MS);
        }
      }, CAST_HINT_MS);
    },
    [clearCastHintTimer, clearIdle, videoRef],
  );

  /** Show chrome and (re)start hide timer when media is actively playing. */
  const bump = useCallback(() => {
    setVisible(true);
    clearIdle();
    const el = videoRef.current;
    const playing = Boolean(el && !el.paused && !el.ended);
    if (
      !playing ||
      forceVisibleRef.current ||
      bufferingRef.current ||
      castHintRef.current
    ) {
      return;
    }
    idleTimer.current = setTimeout(() => setVisible(false), IDLE_MS);
  }, [clearIdle, videoRef]);

  const syncSeekWindow = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isLive) {
      const win = getSeekableWindow(el);
      if (win) {
        setSeekMin(win.start);
        setSeekMax(win.end);
      }
      return;
    }
    setSeekMin(0);
    setSeekMax(Number.isFinite(el.duration) ? el.duration : 0);
  }, [isLive, videoRef]);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
    bump();
  }, [bump, videoRef]);

  const skip = useCallback(
    (delta: number) => {
      const el = videoRef.current;
      if (!el) return;
      seekBySeconds(el, delta);
      if (isLive) onUserSeekLive?.();
      syncSeekWindow();
      bump();
    },
    [bump, isLive, onUserSeekLive, syncSeekWindow, videoRef],
  );

  const toggleMute = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.muted || el.volume === 0) {
      el.muted = false;
      el.volume = lastVolRef.current > 0 ? lastVolRef.current : 0.8;
    } else {
      lastVolRef.current = el.volume > 0 ? el.volume : lastVolRef.current;
      el.muted = true;
    }
    setMuted(el.muted || el.volume === 0);
    setVolume(el.muted ? 0 : el.volume);
    bump();
  }, [bump, videoRef]);

  const onVolume = useCallback(
    (value: number) => {
      const el = videoRef.current;
      if (!el) return;
      const v = Math.min(1, Math.max(0, value));
      el.volume = v;
      el.muted = v === 0;
      if (v > 0) lastVolRef.current = v;
      setVolume(v);
      setMuted(el.muted);
      bump();
    },
    [bump, videoRef],
  );

  const syncCaptions = useCallback(() => {
    const el = videoRef.current;
    if (!el) {
      setHasCaptions(false);
      return;
    }
    const tracks = listCaptionTracks(el);
    setHasCaptions(tracks.length > 0);
    setCaptionsOn(tracks.some((t) => t.mode === "showing"));
  }, [videoRef]);

  const toggleCaptions = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const tracks = listCaptionTracks(el);
    if (!tracks.length) return;
    const turnOn = !tracks.some((t) => t.mode === "showing");
    tracks.forEach((t, i) => {
      t.mode = turnOn && i === 0 ? "showing" : "hidden";
    });
    setCaptionsOn(turnOn);
    bump();
  }, [bump, videoRef]);

  const toggleFullscreen = useCallback(async () => {
    const wrap = rootRef.current?.parentElement;
    const video = videoRef.current as
      | (HTMLVideoElement & {
          webkitEnterFullscreen?: () => void;
          webkitExitFullscreen?: () => void;
          webkitDisplayingFullscreen?: boolean;
          webkitSupportsFullscreen?: boolean;
        })
      | null;

    const inFs =
      Boolean(document.fullscreenElement) ||
      Boolean(video?.webkitDisplayingFullscreen);

    try {
      if (inFs) {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if (typeof video?.webkitExitFullscreen === "function") {
          video.webkitExitFullscreen();
        }
        bump();
        return;
      }

      const standardOk =
        Boolean(document.fullscreenEnabled) &&
        Boolean(wrap) &&
        typeof wrap!.requestFullscreen === "function";

      if (standardOk) {
        await wrap!.requestFullscreen();
        bump();
        return;
      }

      if (
        video &&
        typeof video.webkitEnterFullscreen === "function" &&
        video.webkitSupportsFullscreen !== false
      ) {
        video.webkitEnterFullscreen();
        bump();
        return;
      }

      if (video && typeof video.requestFullscreen === "function") {
        await video.requestFullscreen();
      }
    } catch {
      try {
        if (video && typeof video.webkitEnterFullscreen === "function") {
          video.webkitEnterFullscreen();
        }
      } catch {
        /* TV / permission / unsupported */
      }
    }
    bump();
  }, [bump, videoRef]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const sync = () => {
      setPaused(el.paused);
      setCurrent(el.currentTime || 0);
      setDuration(Number.isFinite(el.duration) ? el.duration : 0);
      setMuted(el.muted || el.volume === 0);
      setVolume(el.muted ? 0 : el.volume);
      if (el.volume > 0 && !el.muted) lastVolRef.current = el.volume;
      syncSeekWindow();
      syncCaptions();
    };
    const onPlay = () => {
      setPaused(false);
      bump();
    };
    const onPause = () => {
      clearBufferTimer();
      setBuffering(false);
      setPaused(true);
      setVisible(true);
      clearIdle();
    };
    const onWaiting = () => {
      clearBufferTimer();
      bufferTimer.current = setTimeout(() => {
        bufferingRef.current = true;
        setBuffering(true);
        setVisible(true);
        clearIdle();
      }, BUFFER_SHOW_MS);
    };
    const onPlaying = () => {
      clearBufferTimer();
      bufferingRef.current = false;
      setBuffering(false);
      setPaused(false);
      bump();
    };
    const onTime = () => {
      setCurrent(el.currentTime || 0);
      if (Number.isFinite(el.duration)) setDuration(el.duration);
      syncSeekWindow();
    };
    const onVol = () => {
      setMuted(el.muted || el.volume === 0);
      setVolume(el.muted ? 0 : el.volume);
      if (el.volume > 0 && !el.muted) lastVolRef.current = el.volume;
      bump();
    };
    const syncFs = () => {
      const webkit = el as HTMLVideoElement & {
        webkitDisplayingFullscreen?: boolean;
      };
      setIsFs(
        Boolean(document.fullscreenElement) ||
          Boolean(webkit.webkitDisplayingFullscreen),
      );
      bump();
    };
    const onTrackChange = () => syncCaptions();

    sync();
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", sync);
    el.addEventListener("durationchange", sync);
    el.addEventListener("volumechange", onVol);
    el.addEventListener("progress", syncSeekWindow);
    document.addEventListener("fullscreenchange", syncFs);
    el.addEventListener("webkitbeginfullscreen", syncFs);
    el.addEventListener("webkitendfullscreen", syncFs);
    el.textTracks?.addEventListener("addtrack", onTrackChange);
    el.textTracks?.addEventListener("change", onTrackChange);

    return () => {
      clearBufferTimer();
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", sync);
      el.removeEventListener("durationchange", sync);
      el.removeEventListener("volumechange", onVol);
      el.removeEventListener("progress", syncSeekWindow);
      document.removeEventListener("fullscreenchange", syncFs);
      el.removeEventListener("webkitbeginfullscreen", syncFs);
      el.removeEventListener("webkitendfullscreen", syncFs);
      el.textTracks?.removeEventListener("addtrack", onTrackChange);
      el.textTracks?.removeEventListener("change", onTrackChange);
    };
  }, [bump, clearBufferTimer, clearIdle, syncCaptions, syncSeekWindow, videoRef]);

  useEffect(() => {
    if (forceVisible) {
      setVisible(true);
      clearIdle();
      return;
    }
    bump();
  }, [bump, clearIdle, forceVisible]);

  useEffect(() => {
    const root = rootRef.current?.parentElement;
    if (!root) return;
    let lastX = Number.NaN;
    let lastY = Number.NaN;
    const show = () => bump();
    const onMove = (e: PointerEvent) => {
      if (e.clientX === lastX && e.clientY === lastY) return;
      lastX = e.clientX;
      lastY = e.clientY;
      bump();
    };
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerdown", show);
    root.addEventListener("touchstart", show, { passive: true });
    const onKey = (e: KeyboardEvent) => {
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "Enter",
          " ",
          "MediaPlayPause",
          "MediaPlay",
          "MediaPause",
          "Escape",
          "f",
          "F",
          "k",
          "K",
          "m",
          "M",
          "c",
          "C",
          "j",
          "J",
          "l",
          "L",
        ].includes(e.key)
      ) {
        show();
      }
      const el = videoRef.current;
      if (!el) return;
      const target = e.target as HTMLElement | null;
      const inField = Boolean(target?.closest?.("input, textarea, select"));
      const inControl = Boolean(target?.closest?.("button, a, input"));

      if (
        (e.key === " " || e.key === "k" || e.key === "K" || e.key === "MediaPlayPause") &&
        !inField
      ) {
        if (e.key === " " && inControl) return;
        e.preventDefault();
        if (el.paused) void el.play();
        else el.pause();
      }
      if (e.key === "MediaPlay") void el.play();
      if (e.key === "MediaPause") el.pause();
      if ((e.key === "m" || e.key === "M") && !inField) {
        e.preventDefault();
        toggleMute();
      }
      if ((e.key === "c" || e.key === "C") && !inField && hasCaptions) {
        e.preventDefault();
        toggleCaptions();
      }
      if ((e.key === "j" || e.key === "J") && !inField) {
        e.preventDefault();
        skip(-SKIP_SEC);
      }
      if ((e.key === "l" || e.key === "L") && !inField) {
        e.preventDefault();
        skip(SKIP_SEC);
      }
      if ((e.key === "f" || e.key === "F") && !inField) {
        void toggleFullscreen();
      }
      if (e.key === "Escape") {
        const webkit = el as HTMLVideoElement & {
          webkitDisplayingFullscreen?: boolean;
          webkitExitFullscreen?: () => void;
        };
        if (document.fullscreenElement) {
          void document.exitFullscreen();
        } else if (
          webkit.webkitDisplayingFullscreen &&
          typeof webkit.webkitExitFullscreen === "function"
        ) {
          webkit.webkitExitFullscreen();
        }
      }
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !inField) {
        if (inControl) return;
        const stage = rootRef.current?.parentElement;
        const focusInPlayer =
          Boolean(stage && stage.contains(document.activeElement)) ||
          Boolean(document.fullscreenElement && stage === document.fullscreenElement);
        if (!focusInPlayer) return;
        e.preventDefault();
        skip(e.key === "ArrowRight" ? SKIP_SEC : -SKIP_SEC);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerdown", show);
      root.removeEventListener("touchstart", show);
      window.removeEventListener("keydown", onKey);
    };
  }, [
    bump,
    hasCaptions,
    skip,
    toggleCaptions,
    toggleFullscreen,
    toggleMute,
    videoRef,
  ]);

  useEffect(() => {
    const el = videoRef.current;
    const fetchable = absoluteStreamUrl(castUrl);
    if (!el || !shouldShowCastControl(format, castUrl)) {
      setCanCast(false);
      return;
    }

    const syncCast = () => {
      setCanCast(castLikelyWorks(el, format) || Boolean(fetchable));
    };
    syncCast();

    const remote = (el as HTMLVideoElement & { remote?: RemotePlayback }).remote;
    if (!remote || typeof remote.watchAvailability !== "function") {
      el.addEventListener("loadedmetadata", syncCast);
      el.addEventListener("emptied", syncCast);
      return () => {
        el.removeEventListener("loadedmetadata", syncCast);
        el.removeEventListener("emptied", syncCast);
      };
    }
    let watchId: number | undefined;
    let cancelled = false;
    try {
      void remote
        .watchAvailability(() => {
          syncCast();
        })
        .then((id) => {
          if (cancelled) {
            try {
              remote.cancelWatchAvailability(id);
            } catch {
              /* ignore */
            }
            return;
          }
          watchId = id;
        });
    } catch {
      /* watchAvailability unsupported */
    }
    el.addEventListener("loadedmetadata", syncCast);
    el.addEventListener("emptied", syncCast);
    return () => {
      cancelled = true;
      el.removeEventListener("loadedmetadata", syncCast);
      el.removeEventListener("emptied", syncCast);
      if (watchId === undefined) return;
      try {
        remote.cancelWatchAvailability(watchId);
      } catch {
        /* ignore */
      }
    };
  }, [format, videoRef, castUrl]);

  useEffect(
    () => () => {
      clearIdle();
      clearBufferTimer();
      clearCastHintTimer();
    },
    [clearBufferTimer, clearCastHintTimer, clearIdle],
  );

  const onSeek = (value: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = clampSeekTime(el, value);
    if (isLive) onUserSeekLive?.();
    syncSeekWindow();
    bump();
  };

  const onCast = async () => {
    const el = videoRef.current;
    bump();
    if (!shouldShowCastControl(format, castUrl)) {
      showCastFeedback(
        "Cast isn’t available for this embed (e.g. YouTube). Open on a TV browser instead.",
      );
      return;
    }
    showCastFeedback("Looking for Cast / AirPlay devices…");
    const result = await promptCastOrAirPlay(el, { format, castUrl });
    const feedback = castFeedbackForResult(result, { format, castUrl });
    if (feedback) {
      showCastFeedback(feedback.message, feedback.copyUrl);
    } else {
      clearCastHintTimer();
      setCastHint(null);
      setCastCopyUrl(null);
      setCopyStatus("idle");
    }
  };

  const onCopyStream = async () => {
    if (!castCopyUrl) return;
    bump();
    try {
      await navigator.clipboard.writeText(castCopyUrl);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  const goNeighbor = (n: ChromeNeighbor | null | undefined) => {
    if (!n) return;
    bump();
    router.push(n.href);
  };

  const showChrome =
    visible || forceVisible || paused || buffering || Boolean(castHint);
  const canScrub = seekMax > seekMin + 1;
  const scrubValue = Math.min(Math.max(current, seekMin), seekMax || current);

  return (
    <div
      ref={rootRef}
      className={`gls-player-chrome absolute inset-0 z-30 ${
        showChrome ? "is-visible" : "is-hidden"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) togglePlay();
      }}
    >
      <button
        type="button"
        className="gls-player-center"
        aria-label={paused ? "Play" : "Pause"}
        tabIndex={showChrome ? 0 : -1}
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
      >
        {paused ? (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        ) : (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
          </svg>
        )}
      </button>

      <div
        className="gls-player-bar"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {title && (
          <p className="mb-2 truncate text-sm font-semibold text-white/90 sm:text-base">
            {title}
          </p>
        )}
        {canScrub && (
          <div className="mb-2 flex items-center gap-2">
            <span className="w-10 shrink-0 text-[11px] tabular-nums text-white/70">
              {isLive
                ? `-${formatTime(Math.max(0, seekMax - current))}`
                : formatTime(current)}
            </span>
            <input
              type="range"
              className="gls-player-scrub"
              min={seekMin}
              max={seekMax}
              step={0.1}
              value={scrubValue}
              aria-label={isLive ? "Seek within buffered window" : "Seek"}
              tabIndex={showChrome ? 0 : -1}
              onChange={(e) => onSeek(Number(e.target.value))}
            />
            <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-white/70">
              {isLive ? "Live" : formatTime(duration)}
            </span>
          </div>
        )}
        {isLive && !canScrub && (
          <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/20">
            <div className="h-full w-full animate-pulse bg-gls-red/80" />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="gls-player-btn"
            aria-label={paused ? "Play" : "Pause"}
            tabIndex={showChrome ? 0 : -1}
            onClick={togglePlay}
          >
            {paused ? "Play" : "Pause"}
          </button>
          <button
            type="button"
            className="gls-player-btn"
            aria-label={`Rewind ${SKIP_SEC} seconds`}
            title={`Rewind ${SKIP_SEC}s`}
            tabIndex={showChrome ? 0 : -1}
            onClick={() => skip(-SKIP_SEC)}
          >
            −{SKIP_SEC}s
          </button>
          <button
            type="button"
            className="gls-player-btn"
            aria-label={`Fast forward ${SKIP_SEC} seconds`}
            title={`Forward ${SKIP_SEC}s`}
            tabIndex={showChrome ? 0 : -1}
            onClick={() => skip(SKIP_SEC)}
          >
            +{SKIP_SEC}s
          </button>
          {prevChannel && (
            <button
              type="button"
              className="gls-player-btn"
              aria-label={`Previous: ${prevChannel.title}`}
              title={prevChannel.title}
              tabIndex={showChrome ? 0 : -1}
              onClick={() => goNeighbor(prevChannel)}
            >
              Prev
            </button>
          )}
          {nextChannel && (
            <button
              type="button"
              className="gls-player-btn"
              aria-label={`Next: ${nextChannel.title}`}
              title={nextChannel.title}
              tabIndex={showChrome ? 0 : -1}
              onClick={() => goNeighbor(nextChannel)}
            >
              Next
            </button>
          )}
          <button
            type="button"
            className="gls-player-btn"
            aria-label={muted ? "Unmute" : "Mute"}
            tabIndex={showChrome ? 0 : -1}
            onClick={toggleMute}
          >
            {muted ? "Unmute" : "Mute"}
          </button>
          <label className="gls-player-vol flex items-center gap-1.5">
            <span className="sr-only">Volume</span>
            <input
              type="range"
              className="gls-player-vol-slider"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              aria-label="Volume"
              tabIndex={showChrome ? 0 : -1}
              onChange={(e) => onVolume(Number(e.target.value))}
            />
          </label>
          {hasCaptions && (
            <button
              type="button"
              className={`gls-player-btn ${captionsOn ? "is-active" : ""}`}
              aria-label={captionsOn ? "Hide subtitles" : "Show subtitles"}
              aria-pressed={captionsOn}
              tabIndex={showChrome ? 0 : -1}
              onClick={toggleCaptions}
            >
              CC
            </button>
          )}
          {shouldShowCastControl(format, castUrl) && (
            <button
              type="button"
              className="gls-player-btn"
              aria-label="Cast or AirPlay"
              title={
                canCast
                  ? "Cast or AirPlay"
                  : "Cast options (this stream may need Chrome Cast menu or TV browser)"
              }
              tabIndex={showChrome ? 0 : -1}
              onClick={() => void onCast()}
            >
              Cast
            </button>
          )}
          <button
            type="button"
            className="gls-player-btn gls-player-fs-btn ml-auto"
            aria-label={isFs ? "Exit fullscreen" : "Fullscreen"}
            tabIndex={showChrome ? 0 : -1}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              void toggleFullscreen();
            }}
          >
            {isFs ? "Exit" : "Full"}
          </button>
        </div>
        {castHint && (
          <div
            className="mt-2 rounded-md bg-black/75 px-2.5 py-2 ring-1 ring-white/20"
            role="status"
          >
            <p className="text-xs leading-snug text-white/90">{castHint}</p>
            {castCopyUrl && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="gls-player-btn !text-[11px]"
                  tabIndex={showChrome ? 0 : -1}
                  onClick={() => void onCopyStream()}
                >
                  {copyStatus === "copied"
                    ? "Copied"
                    : copyStatus === "failed"
                      ? "Copy failed — select link"
                      : "Copy stream link"}
                </button>
                {copyStatus === "failed" && (
                  <span className="max-w-full truncate text-[10px] text-white/55">
                    {castCopyUrl}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

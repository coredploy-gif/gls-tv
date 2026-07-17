"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  castFeedbackForResult,
  castLikelyWorks,
  promptCastOrAirPlay,
  streamSupportsCast,
} from "@/lib/remote-playback";

const IDLE_MS = 2800;
/** Ignore sub-second HLS stalls so live edge waits don't pin chrome open. */
const BUFFER_SHOW_MS = 500;
/** Keep Cast guidance visible long enough to read / copy. */
const CAST_HINT_MS = 12000;

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

export function PlayerChrome({
  videoRef,
  isLive = false,
  title,
  format,
  castUrl = null,
  forceVisible = false,
}: PlayerChromeProps) {
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFs, setIsFs] = useState(false);
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
        // Resume normal idle hide once guidance is gone.
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
    // Keep controls up while Cast guidance is on screen.
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

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
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

      // Prefer stage fullscreen when the Fullscreen API is actually usable.
      // iOS Safari reports fullscreenEnabled=false — skip to webkit path.
      if (standardOk) {
        await wrap!.requestFullscreen();
        bump();
        return;
      }

      // iOS Safari: use video webkitEnterFullscreen (needs playsInline).
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
      // Last-resort iOS path if requestFullscreen threw.
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

    sync();
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", sync);
    el.addEventListener("durationchange", sync);
    // User volume changes are activity; do not listen to `seeking` — live HLS
    // edge sync fires seeking often and would pin chrome open forever.
    el.addEventListener("volumechange", bump);
    document.addEventListener("fullscreenchange", syncFs);
    // iOS Safari webkit fullscreen lifecycle (no document.fullscreenElement).
    el.addEventListener("webkitbeginfullscreen", syncFs);
    el.addEventListener("webkitendfullscreen", syncFs);

    return () => {
      clearBufferTimer();
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", sync);
      el.removeEventListener("durationchange", sync);
      el.removeEventListener("volumechange", bump);
      document.removeEventListener("fullscreenchange", syncFs);
      el.removeEventListener("webkitbeginfullscreen", syncFs);
      el.removeEventListener("webkitendfullscreen", syncFs);
    };
  }, [bump, clearBufferTimer, clearIdle, videoRef]);

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
      // Ignore 0-delta / synthetic noise that would reset the idle timer forever.
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
      if (!isLive && (e.key === "ArrowLeft" || e.key === "ArrowRight") && !inField) {
        if (inControl) return;
        const stage = rootRef.current?.parentElement;
        const focusInPlayer =
          Boolean(stage && stage.contains(document.activeElement)) ||
          Boolean(document.fullscreenElement && stage === document.fullscreenElement);
        if (!focusInPlayer) return;
        e.preventDefault();
        el.currentTime = Math.max(
          0,
          Math.min(
            el.duration || Infinity,
            el.currentTime + (e.key === "ArrowRight" ? 10 : -10),
          ),
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerdown", show);
      root.removeEventListener("touchstart", show);
      window.removeEventListener("keydown", onKey);
    };
  }, [bump, isLive, toggleFullscreen, videoRef]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !streamSupportsCast(format)) {
      setCanCast(false);
      return;
    }

    const syncCast = () => {
      setCanCast(castLikelyWorks(el, format));
    };
    syncCast();

    const remote = (el as HTMLVideoElement & { remote?: RemotePlayback }).remote;
    if (!remote || typeof remote.watchAvailability !== "function") {
      // Re-check when src / MSE attachment may change.
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
    if (!el || isLive) return;
    el.currentTime = value;
    bump();
  };

  const onCast = async () => {
    const el = videoRef.current;
    bump();
    if (!streamSupportsCast(format)) {
      showCastFeedback(
        "Cast isn’t available for this embed (e.g. YouTube). Open on a TV browser instead.",
      );
      return;
    }
    showCastFeedback("Looking for Cast / AirPlay devices…");
    const result = await promptCastOrAirPlay(el);
    const feedback = castFeedbackForResult(result, { format, castUrl });
    if (feedback) {
      showCastFeedback(feedback.message, feedback.copyUrl);
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

  const showChrome =
    visible || forceVisible || paused || buffering || Boolean(castHint);
  const progressMax = !isLive && duration > 0 ? duration : 0;

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
        {!isLive && progressMax > 0 && (
          <div className="mb-2 flex items-center gap-2">
            <span className="w-10 shrink-0 text-[11px] tabular-nums text-white/70">
              {formatTime(current)}
            </span>
            <input
              type="range"
              className="gls-player-scrub"
              min={0}
              max={progressMax}
              step={0.1}
              value={Math.min(current, progressMax)}
              aria-label="Seek"
              tabIndex={showChrome ? 0 : -1}
              onChange={(e) => onSeek(Number(e.target.value))}
            />
            <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-white/70">
              {formatTime(duration)}
            </span>
          </div>
        )}
        {isLive && (
          <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/20">
            <div className="h-full w-full animate-pulse bg-gls-red/80" />
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="gls-player-btn"
            aria-label={paused ? "Play" : "Pause"}
            tabIndex={showChrome ? 0 : -1}
            onClick={togglePlay}
          >
            {paused ? "Play" : "Pause"}
          </button>
          {streamSupportsCast(format) && (
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

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  castCapability,
  promptCastOrAirPlay,
  streamSupportsCast,
} from "@/lib/remote-playback";

const IDLE_MS = 2600;

type PlayerChromeProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  isLive?: boolean;
  title?: string;
  /** Current source format — gates Cast/AirPlay. */
  format?: string;
  /** When true, force chrome visible (errors, buffering start). */
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
  forceVisible = false,
}: PlayerChromeProps) {
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(true);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFs, setIsFs] = useState(false);
  const [castHint, setCastHint] = useState<string | null>(null);
  const [canCast, setCanCast] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const clearIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
  }, []);

  const bump = useCallback(() => {
    setVisible(true);
    clearIdle();
    const el = videoRef.current;
    const playing = el && !el.paused && !el.ended;
    if (!playing || forceVisible) return;
    idleTimer.current = setTimeout(() => setVisible(false), IDLE_MS);
  }, [clearIdle, forceVisible, videoRef]);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
    bump();
  }, [bump, videoRef]);

  const toggleFullscreen = useCallback(async () => {
    const wrap = rootRef.current?.parentElement;
    if (!wrap) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await wrap.requestFullscreen();
      }
    } catch {
      /* TV / permission */
    }
    bump();
  }, [bump]);

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
      setPaused(true);
      setVisible(true);
      clearIdle();
    };
    const onTime = () => {
      setCurrent(el.currentTime || 0);
      if (Number.isFinite(el.duration)) setDuration(el.duration);
    };
    const onFs = () => {
      setIsFs(Boolean(document.fullscreenElement));
      bump();
    };

    sync();
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", sync);
    el.addEventListener("durationchange", sync);
    el.addEventListener("seeking", bump);
    el.addEventListener("volumechange", bump);
    document.addEventListener("fullscreenchange", onFs);

    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", sync);
      el.removeEventListener("durationchange", sync);
      el.removeEventListener("seeking", bump);
      el.removeEventListener("volumechange", bump);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [bump, clearIdle, videoRef]);

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
    const show = () => bump();
    root.addEventListener("pointermove", show);
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
      if (e.key === "Escape" && document.fullscreenElement) {
        void document.exitFullscreen();
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
      root.removeEventListener("pointermove", show);
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
    const kind = castCapability(el);
    setCanCast(kind !== "unavailable");

    const remote = (el as HTMLVideoElement & { remote?: RemotePlayback }).remote;
    if (!remote || typeof remote.watchAvailability !== "function") return;
    let watchId: number | undefined;
    let cancelled = false;
    try {
      void remote
        .watchAvailability((available) => {
          setCanCast(available || castCapability(el) !== "unavailable");
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
    return () => {
      cancelled = true;
      if (watchId === undefined) return;
      try {
        remote.cancelWatchAvailability(watchId);
      } catch {
        /* ignore */
      }
    };
  }, [format, videoRef]);

  useEffect(() => () => clearIdle(), [clearIdle]);

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
      setCastHint(
        "Cast isn’t available for this embed (e.g. YouTube). Open on a TV browser instead.",
      );
      return;
    }
    const result = await promptCastOrAirPlay(el);
    if (result === "unavailable") {
      setCastHint(
        "Cast isn’t available here. On Android, open Chrome’s Cast menu; on iPhone/iPad use AirPlay from Control Center or the video AirPlay control.",
      );
    } else if (result === "error") {
      setCastHint(
        "Couldn’t start Cast / AirPlay. Try again or open this page on your TV.",
      );
    } else {
      setCastHint(null);
    }
  };

  const showChrome = visible || forceVisible || paused;
  const progressMax = !isLive && duration > 0 ? duration : 0;

  return (
    <div
      ref={rootRef}
      className={`gls-player-chrome absolute inset-0 z-10 ${
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
          {(canCast || streamSupportsCast(format)) && (
            <button
              type="button"
              className="gls-player-btn"
              aria-label="Cast or AirPlay"
              tabIndex={showChrome ? 0 : -1}
              onClick={() => void onCast()}
            >
              Cast
            </button>
          )}
          <button
            type="button"
            className="gls-player-btn ml-auto"
            aria-label={isFs ? "Exit fullscreen" : "Fullscreen"}
            tabIndex={showChrome ? 0 : -1}
            onClick={() => void toggleFullscreen()}
          >
            {isFs ? "Exit" : "Full"}
          </button>
        </div>
        {castHint && (
          <p className="mt-2 text-[11px] leading-snug text-white/65" role="status">
            {castHint}
          </p>
        )}
      </div>
    </div>
  );
}

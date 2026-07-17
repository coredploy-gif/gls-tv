"use client";

import { useCallback, useRef, type ReactNode, type RefObject } from "react";
import type { GamePadScheme } from "@/lib/games";

type Props = {
  scheme: GamePadScheme;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  accent?: string;
  /** Show on desktop too */
  forceDesktop?: boolean;
  /** Immersive / expanded shell — always show pad, use compact layout */
  expanded?: boolean;
};

type KeyPhase = "down" | "up" | "tap";

function fireKey(
  iframe: HTMLIFrameElement | null,
  key: string,
  code: string | undefined,
  phase: KeyPhase = "tap",
) {
  const win = iframe?.contentWindow;
  if (!win) return;
  try {
    const init: KeyboardEventInit = {
      key,
      code: code || key,
      bubbles: true,
      cancelable: true,
    };
    // Prefer the iframe realm's KeyboardEvent when available (DOM lib types Window loosely).
    const Ctor =
      (win as Window & { KeyboardEvent?: typeof KeyboardEvent }).KeyboardEvent ||
      KeyboardEvent;
    if (phase === "down" || phase === "tap") {
      win.dispatchEvent(new Ctor("keydown", init));
    }
    if (phase === "up" || phase === "tap") {
      win.dispatchEvent(new Ctor("keyup", init));
    }
  } catch {
    /* cross-origin or torn-down iframe */
  }
}

function PadBtn({
  label,
  aria,
  onPress,
  onHoldStart,
  onHoldEnd,
  className = "",
  wide,
  repeat,
  compact,
}: {
  label: string;
  aria: string;
  onPress: () => void;
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
  className?: string;
  wide?: boolean;
  /** Hold-to-repeat (soft drop / continuous move) */
  repeat?: boolean;
  compact?: boolean;
}) {
  const held = useRef(false);

  const size = compact
    ? wide
      ? "min-h-9 min-w-[3.25rem] px-2.5 text-xs"
      : "h-10 w-10 text-sm"
    : wide
      ? "min-h-12 min-w-[4.5rem] px-4 text-sm"
      : "h-14 w-14 text-sm";

  return (
    <button
      type="button"
      aria-label={aria}
      className={`select-none touch-manipulation rounded-xl border border-white/25 bg-black/70 font-bold text-white shadow-lg backdrop-blur-sm active:scale-95 active:bg-gls-red/80 ${size} ${className}`}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
        if (repeat && onHoldStart) {
          held.current = true;
          onHoldStart();
          return;
        }
        onPress();
      }}
      onPointerUp={() => {
        if (repeat && held.current && onHoldEnd) {
          held.current = false;
          onHoldEnd();
        }
      }}
      onPointerCancel={() => {
        if (repeat && held.current && onHoldEnd) {
          held.current = false;
          onHoldEnd();
        }
      }}
      onPointerLeave={() => {
        if (repeat && held.current && onHoldEnd) {
          held.current = false;
          onHoldEnd();
        }
      }}
    >
      {label}
    </button>
  );
}

/**
 * On-screen controls for keyboard-first HTML5 games (same-origin iframe).
 * Dispatches KeyboardEvents into the game window so existing handlers work.
 */
export function GameVirtualPad({
  scheme,
  iframeRef,
  forceDesktop,
  expanded,
}: Props) {
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const compact = !!expanded;

  const clearRepeat = useCallback(() => {
    if (repeatTimer.current) {
      clearInterval(repeatTimer.current);
      repeatTimer.current = null;
    }
  }, []);

  const send = useCallback(
    (key: string, code?: string, phase: KeyPhase = "tap") => {
      fireKey(iframeRef.current, key, code, phase);
    },
    [iframeRef],
  );

  const startRepeat = useCallback(
    (key: string, code?: string) => {
      clearRepeat();
      send(key, code, "down");
      repeatTimer.current = setInterval(() => {
        send(key, code, "down");
      }, 55);
    },
    [clearRepeat, send],
  );

  const endRepeat = useCallback(
    (key: string, code?: string) => {
      clearRepeat();
      send(key, code, "up");
    },
    [clearRepeat, send],
  );

  if (scheme === "none") return null;

  const gap = compact ? "gap-1" : "gap-1.5";

  const dpad = (
    <div className={`grid grid-cols-3 ${gap}`}>
      <span />
      <PadBtn
        compact={compact}
        label="▲"
        aria="Up"
        onPress={() => send("ArrowUp", "ArrowUp")}
      />
      <span />
      <PadBtn
        compact={compact}
        label="◀"
        aria="Left"
        onPress={() => send("ArrowLeft", "ArrowLeft")}
      />
      <PadBtn
        compact={compact}
        label="▼"
        aria="Down"
        onPress={() => send("ArrowDown", "ArrowDown")}
        repeat
        onHoldStart={() => startRepeat("ArrowDown", "ArrowDown")}
        onHoldEnd={() => endRepeat("ArrowDown", "ArrowDown")}
      />
      <PadBtn
        compact={compact}
        label="▶"
        aria="Right"
        onPress={() => send("ArrowRight", "ArrowRight")}
      />
    </div>
  );

  let body: ReactNode = null;

  if (scheme === "dpad") {
    body = dpad;
  } else if (scheme === "lr") {
    body = (
      <div className={`flex ${compact ? "gap-2" : "gap-3"}`}>
        <PadBtn
          compact={compact}
          wide
          label="◀ Left"
          aria="Left"
          onPress={() => send("ArrowLeft", "ArrowLeft")}
        />
        <PadBtn
          compact={compact}
          wide
          label="Right ▶"
          aria="Right"
          onPress={() => send("ArrowRight", "ArrowRight")}
        />
      </div>
    );
  } else if (scheme === "lr-fire") {
    body = (
      <div
        className={`flex flex-wrap items-center justify-center ${compact ? "gap-2" : "gap-3"}`}
      >
        <PadBtn
          compact={compact}
          wide
          label="◀"
          aria="Left"
          onPress={() => send("ArrowLeft", "ArrowLeft")}
        />
        <PadBtn
          compact={compact}
          wide
          label="Fire"
          aria="Fire"
          onPress={() => send(" ", "Space")}
          className="bg-gls-red/50"
        />
        <PadBtn
          compact={compact}
          wide
          label="▶"
          aria="Right"
          onPress={() => send("ArrowRight", "ArrowRight")}
        />
      </div>
    );
  } else if (scheme === "snake") {
    // Brick-like dock: dpad + Pause side-by-side
    body = (
      <div
        className={`flex flex-wrap items-end justify-center ${compact ? "gap-2" : "gap-4"}`}
      >
        {dpad}
        <PadBtn
          compact={compact}
          wide
          label="Pause"
          aria="Pause"
          onPress={() => send("p", "KeyP")}
          className={
            compact
              ? "min-h-[5.25rem] self-stretch"
              : "min-h-[7.25rem] self-stretch"
          }
        />
      </div>
    );
  } else if (scheme === "brick") {
    // Compact: dpad + 2×2 actions side-by-side (avoids stacking 4 tall buttons)
    body = (
      <div
        className={`flex flex-wrap items-end justify-center ${compact ? "gap-2" : "gap-4"}`}
      >
        {dpad}
        <div className={`grid grid-cols-2 ${gap}`}>
          <PadBtn
            compact={compact}
            wide
            label="Rotate"
            aria="Rotate"
            onPress={() => send("ArrowUp", "ArrowUp")}
          />
          <PadBtn
            compact={compact}
            wide
            label="Soft"
            aria="Soft drop"
            onPress={() => send("ArrowDown", "ArrowDown")}
            repeat
            onHoldStart={() => startRepeat("ArrowDown", "ArrowDown")}
            onHoldEnd={() => endRepeat("ArrowDown", "ArrowDown")}
          />
          <PadBtn
            compact={compact}
            wide
            label="Drop"
            aria="Hard drop"
            onPress={() => send("Enter", "Enter")}
            className="bg-gls-red/50"
          />
          <PadBtn
            compact={compact}
            wide
            label="Pause"
            aria="Pause"
            onPress={() => send("p", "KeyP")}
          />
        </div>
      </div>
    );
  } else if (scheme === "action") {
    body = (
      <PadBtn
        compact={compact}
        wide
        label="Action / Flap"
        aria="Action"
        onPress={() => send(" ", "Space")}
        className={`bg-gls-red/55 ${compact ? "min-h-11 min-w-[8rem] text-sm" : "min-h-16 min-w-[10rem] text-base"}`}
      />
    );
  } else if (scheme === "paddle-v") {
    body = (
      <div className={`flex flex-col ${compact ? "gap-1" : "gap-2"}`}>
        <PadBtn
          compact={compact}
          wide
          label="▲ Up"
          aria="Up"
          onPress={() => send("ArrowUp", "ArrowUp")}
          repeat
          onHoldStart={() => startRepeat("ArrowUp", "ArrowUp")}
          onHoldEnd={() => endRepeat("ArrowUp", "ArrowUp")}
        />
        <PadBtn
          compact={compact}
          wide
          label="▼ Down"
          aria="Down"
          onPress={() => send("ArrowDown", "ArrowDown")}
          repeat
          onHoldStart={() => startRepeat("ArrowDown", "ArrowDown")}
          onHoldEnd={() => endRepeat("ArrowDown", "ArrowDown")}
        />
      </div>
    );
  }

  return (
    <div
      className={`pointer-events-auto touch-manipulation ${
        forceDesktop || expanded ? "" : "lg:hidden"
      }`}
      style={{ WebkitUserSelect: "none", userSelect: "none" }}
    >
      {!compact && (
        <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
          Touch controls
        </p>
      )}
      <div className="flex justify-center">{body}</div>
    </div>
  );
}

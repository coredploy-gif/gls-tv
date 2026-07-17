"use client";

import { useEffect, useRef, useState } from "react";
import { isLargeScreen, isTvLikeDevice } from "@/lib/tv-detect";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

/** iPhone / iPad Safari (incl. iPadOS desktop UA) — no beforeinstallprompt. */
function isIosSafari(): boolean {
  const ua = navigator.userAgent || "";
  const iOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!iOS) return false;
  // Real Safari only — not Chrome/Firefox/Edge WebViews on iOS.
  return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium/i.test(ua);
}

/** Registers /sw.js once for installable PWA (avoids 404 + supports offline shell). */
export function ServiceWorkerRegister() {
  const [updateReady, setUpdateReady] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [tvHint, setTvHint] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const installRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    installRef.current = installEvent;
  }, [installEvent]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      if (sessionStorage.getItem("gls-install-dismiss") === "1") {
        setDismissed(true);
      }
    } catch {
      /* private mode */
    }

    const beforeInstall = (event: Event) => {
      event.preventDefault();
      const bip = event as BeforeInstallPromptEvent;
      installRef.current = bip;
      setInstallEvent(bip);
      setTvHint(false);
      setIosHint(false);
    };

    window.addEventListener("beforeinstallprompt", beforeInstall);

    // Android TV / iOS Safari often never fire beforeinstallprompt — honest tips only.
    const hintTimer = window.setTimeout(() => {
      if (isStandaloneDisplay() || installRef.current) return;
      if (isIosSafari()) {
        setIosHint(true);
        return;
      }
      if (isTvLikeDevice() || (isLargeScreen() && /Android/i.test(navigator.userAgent))) {
        setTvHint(true);
      }
    }, 4500);

    if ("serviceWorker" in navigator) {
      const register = async () => {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js");
          registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            worker?.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller) {
                setUpdateReady(true);
              }
            });
          });
        } catch {
          /* private mode / blocked */
        }
      };
      if (document.readyState === "complete") void register();
      else window.addEventListener("load", () => void register(), { once: true });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.clearTimeout(hintTimer);
    };
  }, []);

  const dismiss = () => {
    setUpdateReady(false);
    setInstallEvent(null);
    setTvHint(false);
    setIosHint(false);
    setDismissed(true);
    try {
      sessionStorage.setItem("gls-install-dismiss", "1");
    } catch {
      /* ignore */
    }
  };

  if (dismissed && !updateReady) return null;
  if (!updateReady && !installEvent && !tvHint && !iosHint) return null;

  const tipText = updateReady
    ? "A GLS TV update is ready."
    : installEvent
      ? "Install GLS TV for quicker access."
      : iosHint
        ? "Add GLS TV to your Home Screen: tap Share, then Add to Home Screen. (iPhone/iPad don’t show an Install button like Chrome.)"
        : "Install GLS TV on this TV: open the Chrome menu (⋮) → Install app or Add to Home screen. Some TV browsers never show an install banner — the menu path is the reliable way.";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-[70] flex max-w-[min(92vw,28rem)] -translate-x-1/2 flex-col gap-2 rounded-lg border border-white/15 bg-black/95 px-4 py-3 text-sm text-white shadow-2xl sm:flex-row sm:items-center sm:gap-3"
    >
      <span className="leading-snug">{tipText}</span>
      <div className="flex shrink-0 items-center gap-2">
        {(updateReady || installEvent) && (
          <button
            type="button"
            className="rounded bg-gls-pink px-3 py-1.5 font-semibold text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            onClick={() => {
              if (updateReady) {
                window.location.reload();
                return;
              }
              void installEvent?.prompt();
              setInstallEvent(null);
            }}
          >
            {updateReady ? "Refresh" : "Install"}
          </button>
        )}
        <button
          type="button"
          aria-label="Dismiss"
          className="rounded px-2 py-1 text-white/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          onClick={dismiss}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

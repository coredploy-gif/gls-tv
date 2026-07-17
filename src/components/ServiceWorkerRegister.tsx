"use client";

import { useEffect, useRef, useState } from "react";
import { isLargeScreen, isTvLikeDevice } from "@/lib/tv-detect";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Registers /sw.js once for installable PWA (avoids 404 + supports offline shell). */
export function ServiceWorkerRegister() {
  const [updateReady, setUpdateReady] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [tvHint, setTvHint] = useState(false);
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

    if (!("serviceWorker" in navigator)) return;

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

    const beforeInstall = (event: Event) => {
      event.preventDefault();
      const bip = event as BeforeInstallPromptEvent;
      installRef.current = bip;
      setInstallEvent(bip);
      setTvHint(false);
    };

    window.addEventListener("beforeinstallprompt", beforeInstall);
    if (document.readyState === "complete") void register();
    else window.addEventListener("load", () => void register(), { once: true });

    // Android TV Chrome often never fires beforeinstallprompt — show honest instructions.
    const hintTimer = window.setTimeout(() => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator &&
          Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
      if (standalone || installRef.current) return;
      if (isTvLikeDevice() || (isLargeScreen() && /Android/i.test(navigator.userAgent))) {
        setTvHint(true);
      }
    }, 4500);

    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.clearTimeout(hintTimer);
    };
  }, []);

  const dismiss = () => {
    setUpdateReady(false);
    setInstallEvent(null);
    setTvHint(false);
    setDismissed(true);
    try {
      sessionStorage.setItem("gls-install-dismiss", "1");
    } catch {
      /* ignore */
    }
  };

  if (dismissed && !updateReady) return null;
  if (!updateReady && !installEvent && !tvHint) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-[70] flex max-w-[min(92vw,28rem)] -translate-x-1/2 flex-col gap-2 rounded-lg border border-white/15 bg-black/95 px-4 py-3 text-sm text-white shadow-2xl sm:flex-row sm:items-center sm:gap-3"
    >
      <span className="leading-snug">
        {updateReady
          ? "A GLS TV update is ready."
          : installEvent
            ? "Install GLS TV for quicker access."
            : "Install GLS TV on this TV: open the Chrome menu (⋮) → Install app or Add to Home screen. Some TV browsers never show an install banner — the menu path is the reliable way."}
      </span>
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

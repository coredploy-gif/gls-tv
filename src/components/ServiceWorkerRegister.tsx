"use client";

import { useEffect, useState } from "react";

/** Registers /sw.js once for installable PWA (avoids 404 + supports offline shell). */
export function ServiceWorkerRegister() {
  const [updateReady, setUpdateReady] = useState(false);
  const [installEvent, setInstallEvent] = useState<Event | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
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
      setInstallEvent(event);
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("beforeinstallprompt", beforeInstall);
  }, []);

  if (!updateReady && !installEvent) return null;
  return (
    <div role="status" aria-live="polite" className="fixed bottom-4 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-lg border border-white/15 bg-black/95 px-4 py-3 text-sm text-white shadow-2xl">
      <span>{updateReady ? "A GLS TV update is ready." : "Install GLS TV for quicker access."}</span>
      <button
        type="button"
        className="rounded bg-gls-pink px-3 py-1.5 font-semibold text-black"
        onClick={() => {
          if (updateReady) {
            window.location.reload();
            return;
          }
          const prompt = installEvent as Event & { prompt?: () => Promise<void> };
          void prompt.prompt?.();
          setInstallEvent(null);
        }}
      >
        {updateReady ? "Refresh" : "Install"}
      </button>
      <button type="button" aria-label="Dismiss" onClick={() => { setUpdateReady(false); setInstallEvent(null); }}>✕</button>
    </div>
  );
}

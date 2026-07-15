"use client";

import { useRouter } from "next/navigation";

type Props = {
  /** Used when there is no in-app history (e.g. opened watch via direct link). */
  fallbackHref: string;
  label?: string;
};

export function WatchBackButton({ fallbackHref, label = "Back" }: Props) {
  const router = useRouter();

  const goBack = () => {
    if (typeof window === "undefined") {
      router.push(fallbackHref);
      return;
    }
    const ref = document.referrer;
    if (ref) {
      try {
        const url = new URL(ref);
        if (
          url.origin === window.location.origin &&
          !url.pathname.startsWith("/watch/")
        ) {
          router.back();
          return;
        }
      } catch {
        /* ignore bad referrer */
      }
    }
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  };

  return (
    <button
      type="button"
      onClick={goBack}
      className="inline-flex items-center gap-2 rounded-sm border border-white/25 bg-black/70 px-3 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-md transition hover:border-white hover:bg-white/10"
    >
      <span aria-hidden>←</span>
      {label}
    </button>
  );
}

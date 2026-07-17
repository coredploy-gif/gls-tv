"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useActiveViewer } from "@/lib/membership/active-viewer";

export function HeaderRefreshButton() {
  const router = useRouter();
  const { refresh: refreshViewer } = useActiveViewer();
  const [busy, setBusy] = useState(false);

  const onRefresh = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      router.refresh();
      await refreshViewer();
    } finally {
      setBusy(false);
    }
  }, [busy, router, refreshViewer]);

  return (
    <button
      type="button"
      onClick={() => void onRefresh()}
      disabled={busy}
      className="rounded-full p-2 text-gls-violet transition hover:bg-gls-violet/15 hover:text-white focus-visible:bg-gls-violet/15 focus-visible:text-white disabled:opacity-60"
      aria-label="Refresh"
      title="Refresh"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className={busy ? "animate-spin" : undefined}
      >
        <path
          d="M21 12a9 9 0 11-2.64-6.36"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M21 3v6h-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M3 12a9 9 0 012.64 6.36"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M3 21v-6h6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

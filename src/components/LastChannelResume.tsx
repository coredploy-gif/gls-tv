"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useActiveViewer } from "@/lib/membership/active-viewer";
import { readLastChannel, type LastChannel } from "@/lib/last-channel";

export function LastChannelResume() {
  const { viewer, ready } = useActiveViewer();
  const [entry, setEntry] = useState<LastChannel | null>(null);

  useEffect(() => {
    if (!ready || !viewer?.id) return;
    setEntry(readLastChannel(viewer.id));
  }, [ready, viewer?.id]);

  if (!entry) return null;

  return (
    <section className="mb-8 rounded-xl border border-white/10 bg-gradient-to-r from-gls-red/15 to-transparent px-5 py-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gls-muted">
        Resume
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-white">{entry.title}</p>
          <p className="text-xs text-gls-muted">Last channel on this profile</p>
        </div>
        <Link
          href={entry.href}
          className="gls-cta rounded-lg px-5 py-2.5 text-sm font-semibold"
        >
          Continue watching
        </Link>
      </div>
    </section>
  );
}

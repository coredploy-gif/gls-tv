"use client";

import { useEffect, useState } from "react";

type Slot = {
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
};

export function EpgNowNext({ slug }: { slug: string }) {
  const [now, setNow] = useState<Slot | null>(null);
  const [next, setNext] = useState<Slot | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/epg/now?slug=${encodeURIComponent(slug)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setNow(data.now || null);
        setNext(data.next || null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!now && !next) return null;

  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gls-muted">
        What’s on
      </p>
      {now && (
        <p className="mt-1 text-white">
          <span className="text-gls-red">Now · </span>
          {now.title}
        </p>
      )}
      {next && (
        <p className="mt-1 text-gls-body">
          <span className="text-gls-muted">Next · </span>
          {next.title}
          <span className="text-gls-muted">
            {" "}
            · {new Date(next.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </p>
      )}
    </div>
  );
}

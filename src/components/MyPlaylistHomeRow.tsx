"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ContentRow } from "@/components/ContentRow";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  channelRowToCatalog,
  mineWatchHref,
  type UserPlaylistChannelRow,
} from "@/lib/playlists";
import type { CatalogItem } from "@/data/types";

export function MyPlaylistHomeRow() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [emptySignedIn, setEmptySignedIn] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      queueMicrotask(() => {
        setItems([]);
        setEmptySignedIn(false);
      });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/playlists", { cache: "no-store" });
        const data = await res.json();
        if (cancelled || !res.ok) return;
        const rows = (data.channels || []) as UserPlaylistChannelRow[];
        setItems(rows.slice(0, 24).map(channelRowToCatalog));
        setEmptySignedIn(rows.length === 0);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  if (loading) return null;

  if (!user) {
    return (
      <section className="mb-8 px-4 sm:mb-10 sm:px-8 lg:px-12">
        <div className="overflow-hidden rounded-sm border border-white/15 bg-gradient-to-r from-gls-red/25 via-white/[0.04] to-transparent p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gls-red">
            Bring your own
          </p>
          <h2 className="gls-display mt-2 text-3xl text-white sm:text-4xl">
            Import your M3U
          </h2>
          <p className="mt-2 max-w-xl text-sm text-gls-body">
            Paste a playlist link, save it to your account, and watch in this
            same layout.
          </p>
          <Link
            href="/playlists"
            className="gls-cta mt-4 inline-flex h-11 items-center rounded px-6 text-sm font-semibold"
          >
            Open My Playlists
          </Link>
        </div>
      </section>
    );
  }

  if (emptySignedIn) {
    return (
      <section className="mb-8 px-4 sm:mb-10 sm:px-8 lg:px-12">
        <div className="rounded-sm border border-dashed border-white/20 bg-white/[0.03] p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Your playlist is empty</h2>
          <p className="mt-1 text-sm text-gls-muted">
            Add an M3U link — channels show here on Home after import.
          </p>
          <Link
            href="/playlists"
            className="mt-3 inline-block text-sm font-medium text-white underline-offset-2 hover:underline"
          >
            Paste playlist link →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <ContentRow
      title="My Playlist"
      items={items}
      limit={18}
      viewMoreHref="/playlists"
      hrefForItem={(ch) => mineWatchHref(ch.id.replace(/^user-/, ""))}
    />
  );
}

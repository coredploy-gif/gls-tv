"use client";

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

  // Signed-out / empty CTAs point to My Links on Home; keep this row for
  // members who already have imported playlist channels.
  if (!user || emptySignedIn) return null;

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

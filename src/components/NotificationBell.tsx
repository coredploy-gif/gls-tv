"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useActiveViewer } from "@/lib/membership/active-viewer";
import { useLibrary } from "@/lib/library";
import {
  formatNotifTime,
  loadReadIds,
  saveReadIds,
  type AppNotification,
} from "@/lib/notifications";

export function NotificationBell() {
  const { viewer } = useActiveViewer();
  const lib = useLibrary();
  const [open, setOpen] = useState(false);
  const [serverItems, setServerItems] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);
  const viewerKey = viewer?.id || lib.viewerKey || "anon";

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/membership/notifications", {
        cache: "no-store",
      });
      const json = (await res.json()) as { items?: AppNotification[] };
      setServerItems(json.items || []);
    } catch {
      setServerItems([]);
    }
  }, []);

  useEffect(() => {
    setReadIds(loadReadIds(viewerKey));
    void refresh();
  }, [viewerKey, refresh]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const activityFromLibrary: AppNotification[] = useMemo(() => {
    return (lib.continueWatching || []).slice(0, 5).map((c) => ({
      id: `continue-${c.slug}-${c.updatedAt}`,
      title: "Continue watching",
      body: c.title,
      href: `/watch/${c.slug}`,
      createdAt: c.updatedAt,
      kind: "activity" as const,
    }));
  }, [lib.continueWatching]);

  const items = useMemo(() => {
    const merged = [...serverItems, ...activityFromLibrary];
    const seen = new Set<string>();
    const out: AppNotification[] = [];
    for (const n of merged.sort((a, b) => b.createdAt - a.createdAt)) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      out.push(n);
    }
    return out.slice(0, 24);
  }, [serverItems, activityFromLibrary]);

  const unread = items.filter((n) => !readIds.has(n.id)).length;

  const markAllRead = () => {
    const next = new Set(readIds);
    for (const n of items) next.add(n.id);
    setReadIds(next);
    saveReadIds(viewerKey, next);
  };

  const markOne = (id: string) => {
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    saveReadIds(viewerKey, next);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void refresh();
        }}
        className="relative rounded-full p-2 text-gls-pink-soft/90 transition hover:bg-gls-pink/15 hover:text-gls-pink"
        aria-label={
          unread ? `Notifications, ${unread} unread` : "Notifications"
        }
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3a5 5 0 00-5 5v1.3c0 .8-.3 1.6-.8 2.2L5 13.5c-.4.5-.1 1.3.5 1.3h13c.6 0 .9-.8.5-1.3l-1.2-1.9a3.5 3.5 0 01-.8-2.2V8a5 5 0 00-5-5z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M9.5 18a2.5 2.5 0 005 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-br from-gls-red to-gls-pink px-1 text-[10px] font-bold leading-none text-white shadow-[0_0_10px_rgba(255,107,157,0.5)]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="gls-glass absolute right-0 top-full z-50 mt-2 w-[min(92vw,360px)] overflow-hidden rounded-xl shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gls-pink-soft">
              Notifications
            </p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[11px] text-gls-muted hover:text-white"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gls-muted">
                No activity yet. Play something to see updates here.
              </p>
            ) : (
              items.map((n) => {
                const unreadItem = !readIds.has(n.id);
                const inner = (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-white">
                        {n.title}
                      </p>
                      {unreadItem && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gls-red" />
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-gls-body">
                      {n.body}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-gls-muted">
                      {n.kind} · {formatNotifTime(n.createdAt)}
                    </p>
                  </>
                );

                const className = `block w-full border-b border-white/5 px-3 py-3 text-left transition hover:bg-white/5 ${
                  unreadItem ? "bg-white/[0.03]" : ""
                }`;

                if (n.href) {
                  return (
                    <Link
                      key={n.id}
                      href={n.href}
                      className={className}
                      onClick={() => {
                        markOne(n.id);
                        setOpen(false);
                      }}
                    >
                      {inner}
                    </Link>
                  );
                }

                return (
                  <button
                    key={n.id}
                    type="button"
                    className={className}
                    onClick={() => markOne(n.id)}
                  >
                    {inner}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

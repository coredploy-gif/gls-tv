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
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds("anon"));
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);
  const viewerKey = viewer?.id || lib.viewerKey || "anon";

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/membership/notifications?filter=all&limit=40", {
        cache: "no-store",
      });
      const json = (await res.json()) as {
        items?: AppNotification[];
        readIds?: string[];
        dismissedIds?: string[];
      };
      setServerItems(json.items || []);
      const serverRead = new Set(json.readIds || []);
      const local = loadReadIds(viewerKey);
      const merged = new Set([...local, ...serverRead]);
      setReadIds(merged);
      saveReadIds(viewerKey, merged);
      setDismissedIds(new Set(json.dismissedIds || []));
    } catch {
      setServerItems([]);
    }
  }, [viewerKey]);

  useEffect(() => {
    queueMicrotask(() => {
      setReadIds(loadReadIds(viewerKey));
      void refresh();
    });
  }, [viewerKey, refresh]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
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

  const allItems = useMemo(() => {
    const merged = [...serverItems, ...activityFromLibrary];
    const seen = new Set<string>();
    const out: AppNotification[] = [];
    for (const n of merged.sort((a, b) => b.createdAt - a.createdAt)) {
      if (seen.has(n.id) || dismissedIds.has(n.id)) continue;
      seen.add(n.id);
      out.push(n);
    }
    return out.slice(0, 24);
  }, [serverItems, activityFromLibrary, dismissedIds]);

  // Bell shows unread only — read items leave the dropdown
  const items = useMemo(
    () => allItems.filter((n) => !readIds.has(n.id)),
    [allItems, readIds],
  );

  const unread = items.length;

  const persistRead = async (ids: string[]) => {
    const next = new Set(readIds);
    for (const id of ids) next.add(id);
    setReadIds(next);
    saveReadIds(viewerKey, next);
    try {
      await fetch("/api/membership/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", ids }),
      });
    } catch {
      /* local state already updated */
    }
  };

  const markAllRead = () => {
    void persistRead(items.map((item) => item.id));
  };

  const markOne = (id: string) => {
    void persistRead([id]);
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
        aria-expanded={open}
        aria-haspopup="dialog"
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
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-3 top-[4.5rem] z-50 max-h-[min(70vh,420px)] overflow-hidden rounded-xl border border-white/15 bg-[#12121a] shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[min(92vw,360px)] sm:max-w-[calc(100vw-1.5rem)]"
        >
          <div className="flex items-center justify-between border-b border-white/10 bg-[#1a1a24] px-3 py-2.5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#f5d0e0]">
              Notifications
            </p>
            <div className="flex items-center gap-3">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-[11px] font-medium text-[#c8c8d8] hover:text-white"
                >
                  Mark all read
                </button>
              )}
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="text-[11px] font-semibold text-gls-pink-soft hover:text-white"
              >
                View all
              </Link>
            </div>
          </div>

          <div className="max-h-[min(60vh,360px)] overflow-y-auto bg-[#12121a]">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-medium text-white">You&apos;re all caught up</p>
                <p className="mt-1 text-xs text-[#a8a8b8]">
                  Read notices live in the Notifications portal.
                </p>
                <Link
                  href="/notifications"
                  onClick={() => setOpen(false)}
                  className="mt-3 inline-block text-xs font-semibold text-gls-pink-soft hover:text-white"
                >
                  Open portal
                </Link>
              </div>
            ) : (
              items.map((n) => {
                const inner = (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{n.title}</p>
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gls-red" />
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-[#c4c4d4]">{n.body}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-[#8e8ea0]">
                      {n.kind} · {formatNotifTime(n.createdAt)}
                    </p>
                  </>
                );

                const className =
                  "block w-full border-b border-white/8 bg-[#16161f] px-3 py-3 text-left transition hover:bg-[#1e1e2a]";

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

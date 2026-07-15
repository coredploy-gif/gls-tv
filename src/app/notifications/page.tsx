"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BrowseNav } from "@/components/BrowseNav";
import {
  formatNotifTime,
  type AppNotification,
} from "@/lib/notifications";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "billing", label: "Billing" },
  { id: "support", label: "Support" },
  { id: "system", label: "System" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

export default function NotificationsPage() {
  const [filter, setFilter] = useState<FilterId>("all");
  const [items, setItems] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (nextOffset = 0, append = false) => {
      setBusy(true);
      if (!append) setStatus("loading");
      try {
        const res = await fetch(
          `/api/membership/notifications?filter=${filter}&limit=30&offset=${nextOffset}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as {
          items?: AppNotification[];
          readIds?: string[];
          hasMore?: boolean;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error || "Failed to load");
        setItems((prev) => (append ? [...prev, ...(json.items || [])] : json.items || []));
        setReadIds(new Set(json.readIds || []));
        setHasMore(Boolean(json.hasMore));
        setOffset(nextOffset + (json.items?.length || 0));
        setStatus("ready");
        setError("");
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Failed to load notifications");
      } finally {
        setBusy(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    queueMicrotask(() => void load(0, false));
  }, [load]);

  const act = async (action: "read" | "dismiss", ids: string[]) => {
    if (!ids.length) return;
    setBusy(true);
    const res = await fetch("/api/membership/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Update failed");
      return;
    }
    if (action === "dismiss") {
      setItems((prev) => prev.filter((n) => !ids.includes(n.id)));
    } else {
      setReadIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
      });
      if (filter === "unread") {
        setItems((prev) => prev.filter((n) => !ids.includes(n.id)));
      }
    }
  };

  return (
    <main className="min-h-screen bg-gls-black pb-28 pt-24">
      <BrowseNav />
      <div className="mx-auto max-w-3xl px-4 sm:px-8">
        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-gls-pink-soft">
            Inbox
          </p>
          <h1 className="gls-display mt-1 text-5xl text-white">Notifications</h1>
          <p className="mt-2 text-sm text-[#b8b8c8]">
            Billing, support replies, and system notices — synced across your devices.
          </p>
        </header>

        <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFilter(f.id);
                setOffset(0);
              }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                filter === f.id
                  ? "bg-white text-black"
                  : "bg-white/5 text-[#c4c4d4] hover:bg-white/10 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            disabled={busy || !items.some((n) => !readIds.has(n.id))}
            onClick={() =>
              void act(
                "read",
                items.filter((n) => !readIds.has(n.id)).map((n) => n.id),
              )
            }
            className="ml-auto rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-semibold text-[#c4c4d4] hover:border-white/30 hover:text-white disabled:opacity-40"
          >
            Mark all read
          </button>
        </div>

        {status === "loading" && (
          <div className="mt-10 space-y-3" aria-busy="true" aria-live="polite">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl bg-white/[0.06]"
              />
            ))}
            <p className="text-center text-sm text-[#8e8ea0]">Loading notifications…</p>
          </div>
        )}

        {status === "error" && (
          <div className="mt-10 rounded-xl border border-red-400/30 bg-red-500/10 p-6 text-center">
            <p className="font-semibold text-white">Could not load notifications</p>
            <p className="mt-1 text-sm text-red-200">{error}</p>
            <button
              type="button"
              onClick={() => void load(0, false)}
              className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-bold text-black"
            >
              Retry
            </button>
          </div>
        )}

        {status === "ready" && items.length === 0 && (
          <div className="mt-12 rounded-xl border border-white/10 bg-[#12121a] px-6 py-14 text-center">
            <p className="text-lg font-semibold text-white">Nothing here yet</p>
            <p className="mt-2 text-sm text-[#a8a8b8]">
              {filter === "unread"
                ? "You're all caught up."
                : "Activity, billing nudges, and support replies will appear here."}
            </p>
            <Link
              href="/browse"
              className="mt-5 inline-block text-sm font-semibold text-gls-pink-soft hover:text-white"
            >
              Back to browsing
            </Link>
          </div>
        )}

        {status === "ready" && items.length > 0 && (
          <ul className="mt-4 space-y-2">
            {items.map((n) => {
              const unread = !readIds.has(n.id);
              return (
                <li
                  key={n.id}
                  className={`rounded-xl border px-4 py-3 transition ${
                    unread
                      ? "border-gls-pink/25 bg-[#181822]"
                      : "border-white/8 bg-[#12121a] opacity-80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white">
                          {n.title}
                        </p>
                        {unread && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-gls-red" />
                        )}
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-[#c4c4d4]">
                        {n.body}
                      </p>
                      <p className="mt-2 text-[10px] uppercase tracking-wide text-[#8e8ea0]">
                        {n.kind} · {formatNotifTime(n.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      {n.href && (
                        <Link
                          href={n.href}
                          onClick={() => {
                            if (unread) void act("read", [n.id]);
                          }}
                          className="rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/20"
                        >
                          Open
                        </Link>
                      )}
                      {unread && (
                        <button
                          type="button"
                          onClick={() => void act("read", [n.id])}
                          className="rounded-md px-2.5 py-1 text-[11px] text-[#c4c4d4] hover:bg-white/10 hover:text-white"
                        >
                          Read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void act("dismiss", [n.id])}
                        className="rounded-md px-2.5 py-1 text-[11px] text-[#8e8ea0] hover:bg-white/10 hover:text-white"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {status === "ready" && hasMore && (
          <div className="mt-6 text-center">
            <button
              type="button"
              disabled={busy}
              onClick={() => void load(offset, true)}
              className="rounded-lg border border-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:border-white/30 disabled:opacity-50"
            >
              {busy ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

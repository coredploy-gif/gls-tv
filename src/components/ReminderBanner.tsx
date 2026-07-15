"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Reminder = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  severity: string;
};

/** Top-of-app banner for urgent billing / admin reminders (hidden on admin/auth). */
export function ReminderBanner() {
  const pathname = usePathname();
  const [item, setItem] = useState<Reminder | null>(null);
  const hidden =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/eadmin") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/profiles");

  const load = useCallback(async () => {
    if (hidden) return;
    try {
      const res = await fetch("/api/membership/reminders");
      if (!res.ok) return;
      const json = await res.json();
      const items = (json.items || []) as Reminder[];
      const urgent =
        items.find((i) => i.severity === "urgent") ||
        items.find((i) => i.severity === "warn") ||
        items[0] ||
        null;
      setItem(urgent);
    } catch {
      /* ignore */
    }
  }, [hidden]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  if (hidden || !item) return null;

  const tone =
    item.severity === "urgent"
      ? "border-gls-red/50 bg-gls-red/15 text-red-50"
      : item.severity === "warn"
        ? "border-amber-500/40 bg-amber-500/12 text-amber-50"
        : "border-sky-500/30 bg-sky-500/10 text-sky-50";

  const dismiss = async () => {
    await fetch("/api/membership/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss", id: item.id }),
    });
    setItem(null);
  };

  return (
    <div
      className={`relative z-40 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 text-sm sm:px-6 ${tone}`}
      role="status"
    >
      <div className="min-w-0">
        <p className="font-semibold">{item.title}</p>
        <p className="mt-0.5 text-xs opacity-90">{item.body}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {item.href && (
          <Link
            href={item.href}
            className="rounded-md bg-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide hover:bg-white/25"
            onClick={() => {
              void fetch("/api/membership/reminders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "read", id: item.id }),
              });
            }}
          >
            Open
          </Link>
        )}
        <button
          type="button"
          onClick={() => void dismiss()}
          className="rounded-md px-2 py-1.5 text-xs opacity-80 hover:opacity-100"
          aria-label="Dismiss reminder"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

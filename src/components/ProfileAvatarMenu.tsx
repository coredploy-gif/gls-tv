"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useActiveViewer } from "@/lib/membership/active-viewer";
import { useAuth } from "@/lib/auth/AuthProvider";

export function ProfileAvatarMenu() {
  const { isAdmin, signOut } = useAuth();
  const { viewer, viewers, switchToProfiles, refresh } = useActiveViewer();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const img =
    viewer?.avatar_url ||
    (viewer
      ? `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(viewer.id)}`
      : null);

  if (!viewer) {
    return (
      <Link
        href="/profiles"
        className="h-8 w-8 overflow-hidden rounded bg-gradient-to-br from-gls-red to-orange-700 ring-2 ring-white/20"
        aria-label="Choose profile"
        title="Who's watching"
      />
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="gls-avatar-ring h-8 w-8 overflow-hidden rounded focus:outline-none"
        aria-label={`Profile ${viewer.name}`}
        aria-expanded={open}
        aria-haspopup="menu"
        title={viewer.name}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img!} alt="" className="h-full w-full object-cover" />
      </button>

      {open && (
        <div
          role="menu"
          className="fixed inset-x-3 top-[4.5rem] z-50 overflow-hidden rounded-xl border border-white/15 bg-[#12121a] shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-56 sm:max-w-[calc(100vw-1.5rem)]"
        >
          <p className="border-b border-white/10 bg-[#1a1a24] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#f5d0e0]">
            Watching as {viewer.name}
          </p>
          <div className="max-h-64 overflow-y-auto py-1">
            {viewers.map((v) => (
              <button
                key={v.id}
                type="button"
                role="menuitem"
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-[#1e1e2a] ${
                  v.id === viewer.id ? "text-white" : "text-[#c4c4d4]"
                }`}
                onClick={async () => {
                  setOpen(false);
                  if (v.id === viewer.id) return;
                  const next = `${window.location.pathname}${window.location.search}`;
                  const res = await fetch("/api/membership/profiles", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "select",
                      viewerId: v.id,
                      ...(next.startsWith("/profiles") ? {} : { next }),
                    }),
                  });
                  const json = await res.json();
                  if (res.ok && json.redirectTo) {
                    window.location.assign(json.redirectTo);
                  } else {
                    await refresh();
                  }
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    v.avatar_url ||
                    `https://api.dicebear.com/9.x/shapes/svg?seed=${v.id}`
                  }
                  alt=""
                  className="h-7 w-7 rounded object-cover"
                />
                <span className="truncate">
                  {v.name}
                  {v.is_kids ? " · Kids" : ""}
                </span>
              </button>
            ))}
          </div>
          <div className="border-t border-white/10 py-1">
            {isAdmin && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block w-full px-3 py-2 text-left text-sm font-semibold text-gls-pink hover:bg-gls-pink/15"
              >
                Admin Portal
              </Link>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                switchToProfiles();
              }}
              className="block w-full px-3 py-2 text-left text-sm text-[#c4c4d4] hover:bg-[#1e1e2a] hover:text-white"
            >
              Switch profiles…
            </button>
            <Link
              href="/profiles/manage"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block w-full px-3 py-2 text-left text-sm text-[#c4c4d4] hover:bg-[#1e1e2a] hover:text-white"
            >
              Manage profiles
            </Link>
            <Link
              href="/billing"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block w-full px-3 py-2 text-left text-sm text-[#c4c4d4] hover:bg-[#1e1e2a] hover:text-white"
            >
              Membership & receipts
            </Link>
            <Link
              href="/account"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block w-full px-3 py-2 text-left text-sm text-[#c4c4d4] hover:bg-[#1e1e2a] hover:text-white"
            >
              Account
            </Link>
            <Link
              href="/support"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block w-full px-3 py-2 text-left text-sm text-[#c4c4d4] hover:bg-[#1e1e2a] hover:text-white"
            >
              Support
            </Link>
            <Link
              href="/notifications"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block w-full px-3 py-2 text-left text-sm text-[#c4c4d4] hover:bg-[#1e1e2a] hover:text-white"
            >
              Notifications
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                setOpen(false);
                await signOut();
                window.location.assign("/");
              }}
              className="block w-full border-t border-white/10 px-3 py-2 text-left text-sm text-red-300 transition hover:bg-gls-red/15 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

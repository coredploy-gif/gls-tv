"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useActiveViewer } from "@/lib/membership/active-viewer";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isEadminEmail } from "@/lib/eadmin";

export function ProfileAvatarMenu() {
  const { user, signOut } = useAuth();
  const { viewer, viewers, switchToProfiles, refresh } = useActiveViewer();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isAdmin = isEadminEmail(user?.email);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
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
        title={viewer.name}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img!} alt="" className="h-full w-full object-cover" />
      </button>

      {open && (
        <div className="gls-glass absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl shadow-xl">
          <p className="border-b border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gls-pink-soft/80">
            Watching as {viewer.name}
          </p>
          <div className="max-h-64 overflow-y-auto py-1">
            {viewers.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-white/10 ${
                  v.id === viewer.id ? "text-white" : "text-gls-body"
                }`}
                onClick={async () => {
                  setOpen(false);
                  if (v.id === viewer.id) return;
                  const res = await fetch("/api/membership/profiles", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "select", viewerId: v.id }),
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
                onClick={() => setOpen(false)}
                className="block w-full px-3 py-2 text-left text-sm font-semibold text-gls-pink hover:bg-gls-pink/15"
              >
                Admin Portal
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                switchToProfiles();
              }}
              className="block w-full px-3 py-2 text-left text-sm text-gls-body hover:bg-white/10 hover:text-white"
            >
              Switch profiles…
            </button>
            <Link
              href="/profiles/manage"
              onClick={() => setOpen(false)}
              className="block w-full px-3 py-2 text-left text-sm text-gls-body hover:bg-white/10 hover:text-white"
            >
              Manage profiles
            </Link>
            <Link
              href="/billing"
              onClick={() => setOpen(false)}
              className="block w-full px-3 py-2 text-left text-sm text-gls-body hover:bg-white/10 hover:text-white"
            >
              Membership & receipts
            </Link>
            <button
              type="button"
              onClick={async () => {
                setOpen(false);
                await signOut();
                window.location.assign("/");
              }}
              className="block w-full border-t border-white/10 px-3 py-2 text-left text-sm text-red-200 transition hover:bg-gls-red/15 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

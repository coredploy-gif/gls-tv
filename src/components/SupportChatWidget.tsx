"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

type Config = {
  welcome_title: string;
  welcome_body: string;
  primary_color: string;
  ask_human_label: string;
  offline_message: string;
  show_kb_first: boolean;
  is_enabled: boolean;
};

type Hit = { id: string; title: string; summary: string };

const STORAGE_KEY = "gls-chat-pos-v1";
const LEGACY_KEY = "gls-support-chat-pos";

type Pos = { x: number; y: number };

function loadPos(): Pos | null {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pos;
    if (typeof p.x === "number" && typeof p.y === "number") return p;
  } catch {
    /* ignore */
  }
  return null;
}

function savePos(p: Pos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function clampToViewport(p: Pos, w: number, h: number): Pos {
  return {
    x: clamp(p.x, 8, Math.max(8, window.innerWidth - w - 8)),
    y: clamp(p.y, 8, Math.max(8, window.innerHeight - h - 8)),
  };
}

/** Floating support widget — KB first, then ticket GLS-####. Draggable, no flash. */
export function SupportChatWidget() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [ticket, setTicket] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const posRef = useRef<Pos | null>(null);
  const drag = useRef<{
    ox: number;
    oy: number;
    sx: number;
    sy: number;
    moved: boolean;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const hide =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/eadmin") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/profiles");

  const updatePos = useCallback((next: Pos) => {
    posRef.current = next;
    setPos(next);
  }, []);

  useEffect(() => {
    const saved = loadPos();
    if (saved) {
      const w = 56;
      const h = 56;
      const clamped = clampToViewport(saved, w, h);
      updatePos(clamped);
    }
  }, [updatePos]);

  useEffect(() => {
    const onResize = () => {
      const p = posRef.current;
      if (!p) return;
      const el = rootRef.current;
      const w = el?.offsetWidth || 56;
      const h = el?.offsetHeight || 56;
      updatePos(clampToViewport(p, w, h));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [updatePos]);

  useEffect(() => {
    if (hide) return;
    fetch("/api/admin/chat-config")
      .then((r) => r.json())
      .then((j) => setConfig(j.config));
  }, [hide]);

  useEffect(() => {
    if (!q.trim() || !config?.show_kb_first) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/admin/knowledge?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((j) => setHits((j.articles || []).slice(0, 3)));
    }, 280);
    return () => clearTimeout(t);
  }, [q, config?.show_kb_first]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    drag.current = {
      ox: e.clientX,
      oy: e.clientY,
      sx: rect.left,
      sy: rect.top,
      moved: false,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.ox;
      const dy = e.clientY - d.oy;
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
      if (!d.moved) return;
      const w = rootRef.current?.offsetWidth || 56;
      const h = rootRef.current?.offsetHeight || 56;
      updatePos(
        clampToViewport(
          { x: d.sx + dx, y: d.sy + dy },
          w,
          h,
        ),
      );
    },
    [updatePos],
  );

  const onPointerUp = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      const p = posRef.current;
      if (p) savePos(p);
      return;
    }
    setOpen((v) => !v);
  }, []);

  if (hide || !config?.is_enabled) return null;

  const escalate = async () => {
    setBusy(true);
    const res = await fetch("/api/admin/helpdesk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_from_chat",
        subject: q.slice(0, 120) || "Support chat",
        description: q || "Requested human support",
        email: user?.email || null,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (res.ok) {
      setTicket(
        `${config.offline_message} Your ticket: ${json.ticketNumber}.`,
      );
    }
  };

  const color = config.primary_color || "#ff6b9d";
  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : { right: 20, bottom: 20 };

  return (
    <div
      ref={rootRef}
      className="fixed z-40 flex flex-col items-end"
      style={style}
    >
      {open && (
        <div
          className="gls-support-pop gls-glass mb-3 w-[min(92vw,352px)] overflow-hidden rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.65)]"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            className="relative overflow-hidden px-4 py-4 text-white"
            style={{
              background: `linear-gradient(135deg, ${color}, #ff6b9dcc 55%, #e8203acc)`,
            }}
          >
            <div className="pointer-events-none absolute -right-4 -top-6 h-24 w-24 rounded-full bg-white/20 blur-2xl" />
            <div className="relative flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold tracking-tight">
                  {config.welcome_title}
                </p>
                <p className="mt-1 text-xs leading-relaxed opacity-90">
                  {config.welcome_body}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-black/25 px-2 py-0.5 text-xs hover:bg-black/40"
                aria-label="Close support"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="bg-[#0e0e14]/90 p-3.5">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ask about GLS TV…"
              className="gls-admin-input"
            />
            {hits.length > 0 && (
              <div className="mt-2.5 max-h-40 space-y-1.5 overflow-y-auto">
                <p className="px-0.5 text-[10px] font-bold uppercase tracking-wider text-gls-muted">
                  Suggested answers
                </p>
                {hits.map((h) => (
                  <div
                    key={h.id}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2"
                  >
                    <p className="text-xs font-semibold text-white">{h.title}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-gls-muted">
                      {h.summary}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={escalate}
              disabled={busy}
              className="mt-3 w-full rounded-lg py-2.5 text-xs font-bold tracking-wide text-white transition hover:brightness-110 disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${color}, #ff6b9d)`,
              }}
            >
              {busy ? "Creating ticket…" : config.ask_human_label}
            </button>
            {ticket && (
              <p className="mt-2.5 rounded-lg bg-emerald-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-emerald-300">
                {ticket}
              </p>
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative flex h-14 w-14 cursor-grab touch-none items-center justify-center overflow-hidden rounded-full text-white transition duration-200 hover:brightness-110 active:cursor-grabbing"
        style={{
          background: `linear-gradient(145deg, ${color} 0%, #ff6b9d 45%, #e8203a 100%)`,
          boxShadow: `0 8px 28px ${color}55, 0 0 0 1px rgba(255,255,255,0.18), inset 0 1px 0 rgba(255,255,255,0.4)`,
        }}
        aria-label="Support chat — drag to move"
        title="Drag to move"
      >
        <span
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.35) 0%, transparent 45%)",
          }}
          aria-hidden
        />
        {open ? (
          <span className="pointer-events-none relative text-lg leading-none">
            ✕
          </span>
        ) : (
          <svg
            className="pointer-events-none relative"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H11l-4 3.5V15H7.5A2.5 2.5 0 0 1 5 12.5v-6Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

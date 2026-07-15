"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useActiveViewer } from "@/lib/membership/active-viewer";

type Config = {
  welcome_title: string;
  welcome_body: string;
  primary_color: string;
  ask_human_label: string;
  offline_message: string;
  show_kb_first: boolean;
  is_enabled: boolean;
};

type Hit = { id: string; slug?: string; title: string; summary: string };
type TicketSummary = {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  updated_at: string;
};
type Message = {
  id: string;
  author_type: string;
  body: string;
  created_at: string;
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function firstName(raw: string | null | undefined) {
  if (!raw) return null;
  const part = raw.trim().split(/\s+/)[0];
  return part || null;
}

/** Floating support widget — Intercom-style panel, WhatsApp bubbles, ticket history. */
export function SupportChatWidget() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { viewer } = useActiveViewer();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [activeTicket, setActiveTicket] = useState<TicketSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"home" | "thread">("home");

  const hide =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/eadmin") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/profiles");

  const greetName =
    firstName(viewer?.name) ||
    firstName(
      (user?.user_metadata?.full_name as string | undefined) ||
        (user?.user_metadata?.name as string | undefined) ||
        user?.email?.split("@")[0],
    );

  const loadTickets = useCallback(async () => {
    if (!user) {
      setTickets([]);
      return;
    }
    try {
      const res = await fetch("/api/support", { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setTickets(json.tickets || []);
    } catch {
      /* ignore */
    }
  }, [user]);

  const openThread = useCallback(async (ticketId: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/support?ticket=${encodeURIComponent(ticketId)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ticket could not be loaded");
      setActiveTicket(json.ticket);
      setMessages(json.messages || []);
      setMode("thread");
      setHistoryOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open ticket");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (hide) return;
    fetch("/api/admin/chat-config")
      .then((r) => r.json())
      .then((j) => setConfig(j.config))
      .catch(() => setConfig(null));
  }, [hide]);

  useEffect(() => {
    if (!open || !user) return;
    queueMicrotask(() => void loadTickets());
  }, [open, user, loadTickets]);

  useEffect(() => {
    if (!q.trim() || !config?.show_kb_first || mode !== "home") {
      queueMicrotask(() => setHits([]));
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/admin/knowledge?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((j) => setHits((j.articles || []).slice(0, 4)))
        .catch(() => setHits([]));
    }, 280);
    return () => clearTimeout(t);
  }, [q, config?.show_kb_first, mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    // Don't lock body scroll on desktop; mobile panel is full-height
    const mq = window.matchMedia("(max-width: 640px)");
    if (mq.matches) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, mode]);

  useEffect(() => {
    if (open && mode === "thread") {
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open, mode, activeTicket?.id]);

  if (hide || !config?.is_enabled) return null;

  const color = config.primary_color || "#ff6b9d";

  const startNewChat = () => {
    setMode("home");
    setActiveTicket(null);
    setMessages([]);
    setDraft("");
    setStatusMsg(null);
    setError(null);
    setHistoryOpen(false);
    setQ("");
  };

  const escalate = async () => {
    if (!user) {
      setError("Sign in to create a support ticket.");
      return;
    }
    const subject = q.slice(0, 120) || "Support chat";
    const message = q.trim().length >= 10 ? q.trim() : `${q.trim()} — Requested human support from chat.`.slice(0, 8000);
    if (message.length < 10) {
      setError("Add a bit more detail (at least 10 characters) before contacting support.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", subject, message }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ticket could not be created");
      setStatusMsg(
        `${config.offline_message} Ticket ${json.ticket.ticket_number} is open.`,
      );
      await loadTickets();
      await openThread(json.ticket.id);
      setQ("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ticket could not be created");
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!activeTicket || !draft.trim()) return;
    if (activeTicket.status === "closed") {
      setError("Reopen the ticket on the Support page before replying.");
      return;
    }
    setSending(true);
    setError(null);
    const body = draft.trim();
    setDraft("");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply",
          ticketId: activeTicket.id,
          message: body,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Reply failed");
      await openThread(activeTicket.id);
      await loadTickets();
    } catch (err) {
      setDraft(body);
      setError(err instanceof Error ? err.message : "Reply failed");
    } finally {
      setSending(false);
    }
  };

  const unreadHint = tickets.filter((t) =>
    ["open", "waiting", "in_progress"].includes(t.status),
  ).length;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 sm:bg-transparent"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}

      <div className="pointer-events-none fixed bottom-0 right-0 z-[70] flex flex-col items-end p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:bottom-4 sm:right-4 sm:p-0">
        {open && (
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="pointer-events-auto mb-3 flex h-[min(100dvh-5.5rem,640px)] w-[min(100vw-1.5rem,400px)] max-w-full flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0e0e14] shadow-[0_24px_64px_rgba(0,0,0,0.65)] sm:mb-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-h-0 flex-1">
              {/* History sidebar */}
              <aside
                className={`flex shrink-0 flex-col border-r border-white/10 bg-[#12121a] transition-[width] ${
                  historyOpen ? "w-[132px]" : "w-0 overflow-hidden border-0"
                }`}
                aria-label="Chat history"
              >
                {historyOpen && (
                  <>
                    <button
                      type="button"
                      onClick={startNewChat}
                      className="m-2 rounded-lg px-2 py-2 text-[11px] font-bold text-white"
                      style={{ background: color }}
                    >
                      + New chat
                    </button>
                    <div className="flex-1 overflow-y-auto px-1.5 pb-2">
                      {!user && (
                        <p className="px-1 text-[10px] text-[#8e8ea0]">
                          Sign in to see history
                        </p>
                      )}
                      {tickets.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => void openThread(t.id)}
                          className={`mb-1 w-full rounded-md px-1.5 py-1.5 text-left transition hover:bg-white/10 ${
                            activeTicket?.id === t.id ? "bg-white/10" : ""
                          }`}
                        >
                          <p className="truncate font-mono text-[9px] text-gls-pink-soft">
                            {t.ticket_number}
                          </p>
                          <p className="truncate text-[10px] text-[#c4c4d4]">
                            {t.subject}
                          </p>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </aside>

              <div className="flex min-w-0 flex-1 flex-col">
                <header
                  className="relative shrink-0 overflow-hidden px-3 py-3 text-white"
                  style={{
                    background: `linear-gradient(135deg, ${color}, #ff6b9dcc 55%, #e8203acc)`,
                  }}
                >
                  <div className="relative flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => setHistoryOpen((v) => !v)}
                      className="mt-0.5 rounded-md bg-black/25 px-2 py-1 text-[11px] font-semibold hover:bg-black/40"
                      aria-expanded={historyOpen}
                      aria-label="Toggle chat history"
                    >
                      ☰
                    </button>
                    <div className="min-w-0 flex-1">
                      <p id={titleId} className="font-semibold tracking-tight">
                        {config.welcome_title}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed opacity-95">
                        {greetName
                          ? `Hi ${greetName} — ${config.welcome_body}`
                          : config.welcome_body}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-full bg-black/25 px-2 py-0.5 text-sm hover:bg-black/40"
                      aria-label="Close support chat"
                    >
                      ×
                    </button>
                  </div>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto bg-[#0e0e14] p-3">
                  {mode === "home" && (
                    <>
                      <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Ask about GLS TV…"
                        className="w-full rounded-xl border border-white/15 bg-[#16161f] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#6e6e80] focus:border-white/30"
                        aria-label="Search help"
                      />
                      {hits.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          <p className="px-0.5 text-[10px] font-bold uppercase tracking-wider text-[#8e8ea0]">
                            Suggested answers
                          </p>
                          {hits.map((h) => (
                            <div
                              key={h.id}
                              className="rounded-xl border border-white/10 bg-[#16161f] px-3 py-2"
                            >
                              <p className="text-xs font-semibold text-white">
                                {h.title}
                              </p>
                              <p className="mt-0.5 text-[11px] leading-snug text-[#a8a8b8]">
                                {h.summary}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => void escalate()}
                        disabled={busy}
                        className="mt-3 w-full rounded-xl py-2.5 text-xs font-bold tracking-wide text-white transition hover:brightness-110 disabled:opacity-50"
                        style={{
                          background: `linear-gradient(135deg, ${color}, #ff6b9d)`,
                        }}
                      >
                        {busy ? "Creating ticket…" : config.ask_human_label}
                      </button>
                      {!user && (
                        <p className="mt-2 text-center text-[11px] text-[#a8a8b8]">
                          <Link href="/auth" className="underline text-white">
                            Sign in
                          </Link>{" "}
                          to open a ticket, or message us from the sign-in page.
                        </p>
                      )}
                      {statusMsg && (
                        <p
                          role="status"
                          className="mt-2 rounded-lg bg-emerald-500/10 px-2.5 py-2 text-[11px] text-emerald-200"
                        >
                          {statusMsg}
                        </p>
                      )}
                    </>
                  )}

                  {mode === "thread" && activeTicket && (
                    <>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                          <p className="font-mono text-[10px] text-gls-pink-soft">
                            {activeTicket.ticket_number} · {activeTicket.status}
                          </p>
                          <p className="text-sm font-semibold text-white">
                            {activeTicket.subject}
                          </p>
                        </div>
                        <Link
                          href={`/support?ticket=${encodeURIComponent(activeTicket.id)}`}
                          className="text-[10px] font-semibold text-[#a8a8b8] underline hover:text-white"
                        >
                          Full page
                        </Link>
                      </div>
                      {busy && !messages.length && (
                        <p className="text-sm text-[#8e8ea0]">Loading thread…</p>
                      )}
                      <div className="space-y-2" aria-live="polite">
                        {messages.map((m) => {
                          const mine = m.author_type === "user";
                          const system = m.author_type === "system";
                          return (
                            <div
                              key={m.id}
                              className={`flex ${mine ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${
                                  system
                                    ? "rounded-md border border-white/10 bg-white/5 text-[#a8a8b8]"
                                    : mine
                                      ? "rounded-br-md text-white"
                                      : "rounded-bl-md bg-[#1c1c28] text-[#e8e8f0]"
                                }`}
                                style={
                                  mine
                                    ? {
                                        background: `linear-gradient(135deg, ${color}, #e8203a)`,
                                      }
                                    : undefined
                                }
                              >
                                {!mine && !system && (
                                  <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-gls-pink-soft">
                                    GLS Support
                                  </p>
                                )}
                                <p className="whitespace-pre-wrap">{m.body}</p>
                                <p
                                  className={`mt-1 text-[9px] ${
                                    mine ? "text-white/70" : "text-[#6e6e80]"
                                  }`}
                                >
                                  {formatTime(m.created_at)}
                                  {mine ? " · Sent" : ""}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                        {sending && (
                          <div className="flex justify-end">
                            <div className="rounded-2xl rounded-br-md bg-white/10 px-3 py-2 text-[11px] text-[#a8a8b8]">
                              Sending…
                            </div>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    </>
                  )}

                  {error && (
                    <p
                      role="alert"
                      className="mt-2 rounded-lg bg-red-500/10 px-2.5 py-2 text-[11px] text-red-200"
                    >
                      {error}
                    </p>
                  )}
                </div>

                {mode === "thread" && activeTicket && (
                  <form
                    onSubmit={(e) => void sendReply(e)}
                    className="shrink-0 border-t border-white/10 bg-[#12121a] p-2.5"
                  >
                    <div className="flex items-end gap-2">
                      <textarea
                        ref={inputRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={2}
                        placeholder="Type a reply…"
                        className="max-h-28 min-h-[44px] flex-1 resize-none rounded-xl border border-white/15 bg-[#0e0e14] px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void sendReply();
                          }
                        }}
                      />
                      <button
                        type="submit"
                        disabled={sending || !draft.trim()}
                        className="rounded-xl px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40"
                        style={{ background: color }}
                      >
                        Send
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="pointer-events-auto relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full text-white transition duration-200 hover:brightness-110"
          style={{
            background: `linear-gradient(145deg, ${color} 0%, #ff6b9d 45%, #e8203a 100%)`,
            boxShadow: `0 8px 28px ${color}55, 0 0 0 1px rgba(255,255,255,0.18)`,
          }}
          aria-label={open ? "Close support chat" : "Open support chat"}
          aria-expanded={open}
          aria-controls={open ? titleId : undefined}
        >
          {unreadHint > 0 && !open && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-gls-red">
              {unreadHint > 9 ? "9+" : unreadHint}
            </span>
          )}
          {open ? (
            <span className="text-lg leading-none">×</span>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
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
    </>
  );
}

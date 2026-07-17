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
import { createClient } from "@/lib/supabase/client";
import { useIsTvLikeDevice } from "@/lib/useIsTvLikeDevice";

type Config = {
  welcome_title: string;
  welcome_body: string;
  primary_color: string;
  offline_message: string;
  is_enabled: boolean;
};

type TicketSummary = {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  updated_at: string;
  escalated_at?: string | null;
};

type Message = {
  id: string;
  author_type: string;
  body: string;
  created_at: string;
};

const GLS_RED = "#e50914";

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

function isEscalationPrompt(body: string) {
  return body.includes("speak to an agent") && body.includes("Reply");
}

/** Floating live chat — KB-first, Send-only composer, GLS red styling. */
export function SupportChatWidget() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { viewer } = useActiveViewer();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [activeTicket, setActiveTicket] = useState<TicketSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const tvLike = useIsTvLikeDevice();

  const hide =
    tvLike ||
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

  const accent = GLS_RED;

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
      if (!res.ok) throw new Error(json.error || "Chat could not be loaded");
      setActiveTicket(json.ticket);
      setMessages(json.messages || []);
      setHistoryOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open chat");
    } finally {
      setBusy(false);
    }
  }, []);

  const startNewChat = useCallback(() => {
    setActiveTicket(null);
    setMessages([]);
    setDraft("");
    setError(null);
    setHistoryOpen(false);
    setConfirmDelete(false);
    setDeleteInput("");
    queueMicrotask(() => inputRef.current?.focus());
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
    const mq = window.matchMedia("(max-width: 640px)");
    if (mq.matches) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (open) queueMicrotask(() => inputRef.current?.focus());
  }, [open, activeTicket?.id]);

  // Polling fallback for near-real-time updates
  useEffect(() => {
    if (!open || !activeTicket?.id || !user) return;
    pollRef.current = setInterval(() => {
      void openThread(activeTicket.id);
    }, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open, activeTicket?.id, user, openThread]);

  // Supabase Realtime on helpdesk_messages
  useEffect(() => {
    if (!open || !activeTicket?.id || !user) return;
    const sb = createClient();
    const channel = sb
      .channel(`chat-${activeTicket.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "helpdesk_messages",
          filter: `ticket_id=eq.${activeTicket.id}`,
        },
        () => {
          void openThread(activeTicket.id);
        },
      )
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [open, activeTicket?.id, user, openThread]);

  const sendMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!user) {
      setError("Sign in to send messages.");
      return;
    }
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setError(null);
    setDraft("");

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          ticketId: activeTicket?.id,
          message: body,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Message could not be sent");
      setActiveTicket(json.ticket);
      setMessages(json.messages || []);
      await loadTickets();
    } catch (err) {
      setDraft(body);
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const escalate = async () => {
    if (!activeTicket) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "escalate", ticketId: activeTicket.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not reach support queue");
      await openThread(activeTicket.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Escalation failed");
    } finally {
      setBusy(false);
    }
  };

  const clearHistory = async () => {
    if (deleteInput !== "DELETE") {
      setError('Type DELETE to confirm.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_history", confirm: "DELETE" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "History could not be cleared");
      setTickets([]);
      startNewChat();
      setConfirmDelete(false);
      setDeleteInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  if (hide || !config?.is_enabled) return null;

  const unreadHint = tickets.filter((t) =>
    ["open", "waiting", "in_progress"].includes(t.status),
  ).length;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 sm:bg-transparent"
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
            className="gls-chat-panel pointer-events-auto mb-3 flex h-[min(100dvh-5.5rem,640px)] w-[min(100vw-1.5rem,400px)] max-w-full flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0c0c0c] shadow-[0_24px_64px_rgba(0,0,0,0.7)] sm:mb-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-h-0 flex-1">
              <aside
                className={`flex shrink-0 flex-col border-r border-white/10 bg-[#111111] transition-[width] duration-300 ease-out ${
                  historyOpen ? "w-[140px]" : "w-0 overflow-hidden border-0"
                }`}
                aria-label="Chat history"
              >
                {historyOpen && (
                  <>
                    <button
                      type="button"
                      onClick={startNewChat}
                      className="m-2 rounded-lg bg-gls-red px-2 py-2 text-[11px] font-bold text-white transition hover:bg-gls-red-hot"
                    >
                      + New chat
                    </button>
                    <div className="flex-1 overflow-y-auto px-1.5 pb-2">
                      {!user && (
                        <p className="px-1 text-[10px] text-gls-muted">Sign in to see history</p>
                      )}
                      {tickets.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => void openThread(t.id)}
                          className={`mb-1 w-full rounded-md px-1.5 py-1.5 text-left transition hover:bg-white/8 ${
                            activeTicket?.id === t.id ? "bg-white/10" : ""
                          }`}
                        >
                          <p className="truncate font-mono text-[9px] text-gls-red">{t.ticket_number}</p>
                          <p className="truncate text-[10px] text-gls-body">{t.subject}</p>
                        </button>
                      ))}
                    </div>
                    {user && tickets.length > 0 && (
                      <div className="border-t border-white/10 p-2">
                        {!confirmDelete ? (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(true)}
                            className="w-full rounded-md px-1 py-1.5 text-[10px] text-red-300 hover:bg-red-950/40"
                          >
                            Clear history
                          </button>
                        ) : (
                          <div className="space-y-1">
                            <input
                              value={deleteInput}
                              onChange={(e) => setDeleteInput(e.target.value)}
                              placeholder="DELETE"
                              className="w-full rounded border border-white/15 bg-black px-1.5 py-1 text-[10px] text-white"
                            />
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void clearHistory()}
                              className="w-full rounded bg-red-700 px-1 py-1 text-[10px] font-bold text-white disabled:opacity-50"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDelete(false);
                                setDeleteInput("");
                              }}
                              className="w-full text-[10px] text-gls-muted underline"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </aside>

              <div className="flex min-w-0 flex-1 flex-col">
                <header className="relative shrink-0 overflow-hidden bg-gradient-to-br from-gls-red via-[#c40812] to-[#8a060e] px-3 py-3 text-white">
                  <div className="relative flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => setHistoryOpen((v) => !v)}
                      className="mt-0.5 rounded-md bg-black/30 px-2 py-1 text-[11px] font-semibold hover:bg-black/45"
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
                      className="rounded-full bg-black/30 px-2 py-0.5 text-sm hover:bg-black/45"
                      aria-label="Close support chat"
                    >
                      ×
                    </button>
                  </div>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto bg-[#0c0c0c] p-3">
                  {!user && (
                    <div className="mb-3 rounded-xl border border-white/10 bg-[#141414] px-3 py-3 text-center">
                      <p className="text-sm text-gls-body">Sign in to chat with GLS support.</p>
                      <Link
                        href="/auth"
                        className="mt-2 inline-block text-sm font-semibold text-gls-red hover:text-white"
                      >
                        Sign in
                      </Link>
                    </div>
                  )}

                  {user && activeTicket && (
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-mono text-[10px] text-gls-red">
                          {activeTicket.ticket_number} · {activeTicket.status}
                          {activeTicket.escalated_at ? " · Agent queue" : " · KB assistant"}
                        </p>
                        <p className="text-sm font-semibold text-white">{activeTicket.subject}</p>
                      </div>
                      <Link
                        href={`/support?ticket=${encodeURIComponent(activeTicket.id)}`}
                        className="text-[10px] font-semibold text-gls-muted underline hover:text-white"
                      >
                        Full page
                      </Link>
                    </div>
                  )}

                  {user && !activeTicket && !busy && messages.length === 0 && (
                    <p className="mb-3 text-sm text-gls-muted">
                      Ask anything about GLS TV — we search our knowledge base first.
                    </p>
                  )}

                  {busy && !messages.length && activeTicket && (
                    <p className="text-sm text-gls-muted">Loading messages…</p>
                  )}

                  <div className="space-y-2" aria-live="polite">
                    {messages.map((m) => {
                      const mine = m.author_type === "user";
                      const system = m.author_type === "system";
                      const agent = m.author_type === "agent";
                      const showEscalate = system && isEscalationPrompt(m.body);

                      return (
                        <div
                          key={m.id}
                          className={`gls-chat-msg flex ${mine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${
                              system
                                ? "rounded-md border border-white/10 bg-[#161616] text-gls-body"
                                : mine
                                  ? "rounded-br-md bg-gls-red text-white"
                                  : "rounded-bl-md bg-[#1a1a1a] text-gls-body"
                            }`}
                          >
                            {agent && (
                              <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-gls-red">
                                GLS Support
                              </p>
                            )}
                            {system && !showEscalate && (
                              <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-gls-muted">
                                GLS Assistant
                              </p>
                            )}
                            <p className="whitespace-pre-wrap">{m.body.replace(/\*\*/g, "")}</p>
                            {showEscalate && !activeTicket?.escalated_at && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void escalate()}
                                className="mt-2 rounded-lg border border-gls-red/40 bg-gls-red/10 px-2.5 py-1.5 text-[11px] font-semibold text-gls-red transition hover:bg-gls-red/20 disabled:opacity-50"
                              >
                                Speak to an agent
                              </button>
                            )}
                            <p
                              className={`mt-1 text-[9px] ${
                                mine ? "text-white/70" : "text-gls-muted"
                              }`}
                            >
                              {formatTime(m.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {sending && (
                      <div className="flex justify-end">
                        <div className="rounded-2xl rounded-br-md bg-white/8 px-3 py-2 text-[11px] text-gls-muted">
                          Sending…
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {error && (
                    <p
                      role="alert"
                      className="mt-2 rounded-lg bg-red-500/10 px-2.5 py-2 text-[11px] text-red-200"
                    >
                      {error}
                    </p>
                  )}
                </div>

                <form
                  onSubmit={(e) => void sendMessage(e)}
                  className="shrink-0 border-t border-white/10 bg-[#111111] p-2.5"
                >
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={inputRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={2}
                      disabled={!user || sending}
                      placeholder={
                        user
                          ? "Type your message…"
                          : "Sign in to send messages"
                      }
                      className="max-h-28 min-h-[44px] flex-1 resize-none rounded-xl border border-white/12 bg-[#0c0c0c] px-3 py-2 text-sm text-white outline-none focus:border-gls-red/50 disabled:opacity-50"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendMessage();
                        }
                      }}
                    />
                    <button
                      type="submit"
                      disabled={sending || !draft.trim() || !user}
                      className="gls-chat-send rounded-xl bg-gls-red px-3 py-2.5 text-xs font-bold text-white transition hover:bg-gls-red-hot disabled:opacity-40"
                    >
                      Send
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="gls-chat-launcher pointer-events-auto relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gls-red text-white shadow-[0_8px_28px_rgba(229,9,20,0.45)] transition duration-200 hover:bg-gls-red-hot"
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

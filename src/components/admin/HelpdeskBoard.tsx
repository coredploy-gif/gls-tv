"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type Ticket = {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  requester_email: string | null;
  assignee_email: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

type Message = {
  id: string;
  author_type: string;
  author_email: string | null;
  body: string;
  created_at: string;
};

const STATUSES = ["all", "open", "in_progress", "waiting", "resolved", "closed"];
const PRIORITIES = ["all", "low", "medium", "high", "urgent"];
const BOARD_COLS = ["open", "in_progress", "waiting", "resolved", "closed"];

const PRIORITY_TONE: Record<string, string> = {
  low: "bg-white/10 text-gls-body",
  medium: "bg-amber-500/15 text-amber-200",
  high: "bg-orange-500/20 text-orange-200",
  urgent: "bg-gls-red/25 text-red-200",
};

const STATUS_TONE: Record<string, string> = {
  open: "bg-sky-500/15 text-sky-200",
  in_progress: "bg-violet-500/15 text-violet-200",
  waiting: "bg-amber-500/15 text-amber-200",
  resolved: "bg-emerald-500/15 text-emerald-200",
  closed: "bg-white/10 text-gls-muted",
};

function HelpdeskBoardInner() {
  const router = useRouter();
  const search = useSearchParams();
  const ticketFromUrl = search.get("ticket");
  const closingRef = useRef(false);
  const [view, setView] = useState<"list" | "board">("list");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [source, setSource] = useState("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [threadErr, setThreadErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const params = new URLSearchParams({ status, priority, source, q });
      const res = await fetch(`/api/admin/helpdesk?${params}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr((json as { error?: string }).error || "Failed");
        return;
      }
      setTickets((json as { tickets?: Ticket[] }).tickets || []);
    } catch {
      setErr("Helpdesk list could not be loaded");
    } finally {
      setBusy(false);
    }
  }, [status, priority, source, q]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const openTicket = useCallback(
    async (t: Ticket | string) => {
      const id = typeof t === "string" ? t : t.id;
      closingRef.current = false;
      setThreadLoading(true);
      setThreadErr(null);
      try {
        const res = await fetch(`/api/admin/helpdesk?ticketId=${id}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setThreadErr(
            (json as { error?: string }).error || "Thread could not be loaded",
          );
          setMessages([]);
          return;
        }
        const ticket = (json as { ticket: Ticket }).ticket;
        const nextMessages = (json as { messages?: Message[] }).messages || [];
        setSelected((prev) => {
          if (prev?.id && prev.id !== ticket.id) {
            queueMicrotask(() => setReply(""));
          }
          return ticket;
        });
        setMessages(nextMessages);
        const nextUrl = `/admin/helpdesk?ticket=${encodeURIComponent(id)}`;
        if (
          typeof window !== "undefined" &&
          `${window.location.pathname}${window.location.search}` !== nextUrl
        ) {
          router.replace(nextUrl, { scroll: false });
        }
      } catch {
        setThreadErr("Thread could not be loaded");
        setMessages([]);
      } finally {
        setThreadLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    if (!ticketFromUrl) {
      closingRef.current = false;
      return;
    }
    // Avoid re-opening while router.replace is still clearing ?ticket=
    if (closingRef.current) return;
    if (selected?.id === ticketFromUrl) return;
    queueMicrotask(() => void openTicket(ticketFromUrl));
  }, [ticketFromUrl, openTicket, selected?.id]);

  const updateStatus = async (id: string, next: string) => {
    const res = await fetch("/api/admin/helpdesk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, status: next }),
    });
    if (res.ok) {
      void load();
      if (selected?.id === id) void openTicket(id);
    }
  };

  const sendReply = async () => {
    if (!selected || !reply.trim() || sending) return;
    const ticketId = selected.id;
    const body = reply.trim();
    setSending(true);
    setThreadErr(null);
    try {
      const res = await fetch("/api/admin/helpdesk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply",
          id: ticketId,
          body,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setThreadErr(
          (json as { error?: string }).error || "Reply failed — try again",
        );
        return;
      }
      setReply("");
      setMessages((prev) => {
        const optimistic = (json as { message?: Message }).message;
        return optimistic ? [...prev, optimistic] : prev;
      });
      await openTicket(ticketId);
      void load();
    } catch {
      setThreadErr("Reply failed — check your connection and try again");
    } finally {
      setSending(false);
    }
  };

  const createTicket = async () => {
    const subject = prompt("Ticket subject?");
    if (!subject?.trim()) return;
    await fetch("/api/admin/helpdesk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", subject }),
    });
    void load();
  };

  const byCol = useMemo(() => {
    const map: Record<string, Ticket[]> = {};
    for (const c of BOARD_COLS) map[c] = [];
    for (const t of tickets) {
      (map[t.status] || (map[t.status] = [])).push(t);
    }
    return map;
  }, [tickets]);

  const closeModal = () => {
    closingRef.current = true;
    setSelected(null);
    setMessages([]);
    setReply("");
    setThreadErr(null);
    router.replace("/admin/helpdesk", { scroll: false });
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Support desk"
        title="Helpdesk"
        description="Member chat tickets and converted public contacts. Open a row for the full thread."
        actions={
          <>
            <div className="flex overflow-hidden rounded-md border border-white/15 bg-black/40 p-0.5">
              {(["list", "board"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`rounded px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                    view === v
                      ? "bg-white text-black"
                      : "text-gls-muted hover:text-white"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={createTicket}
              className="gls-cta rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide"
            >
              + Ticket
            </button>
          </>
        }
      />

      <div className="gls-admin-card mt-8 flex flex-wrap gap-2 rounded-lg p-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter subject / GLS- / email"
          className="gls-admin-input min-w-[200px] flex-1"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="gls-admin-input w-auto"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              Status: {s}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="gls-admin-input w-auto"
        >
          {PRIORITIES.map((s) => (
            <option key={s} value={s}>
              Priority: {s}
            </option>
          ))}
        </select>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="gls-admin-input w-auto"
        >
          {["all", "chat", "contact", "email", "manual", "system"].map((s) => (
            <option key={s} value={s}>
              Source: {s}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-white/20 px-4 py-2 text-sm text-gls-body transition hover:border-white/40 hover:text-white"
        >
          {busy ? "…" : "Apply"}
        </button>
      </div>

      {err && <p className="mt-3 text-sm text-gls-red">{err}</p>}

      {view === "list" ? (
        <div className="gls-admin-card mt-4 overflow-x-auto rounded-lg">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-[0.18em] text-gls-muted">
              <tr>
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Requester</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer border-t border-white/[0.04] transition hover:bg-gls-red/[0.06]"
                  onClick={() => void openTicket(t)}
                >
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-gls-red">
                    {t.ticket_number}
                  </td>
                  <td className="px-4 py-3 font-medium text-white">{t.subject}</td>
                  <td className="px-4 py-3">
                    <select
                      value={t.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateStatus(t.id, e.target.value)}
                      className={`gls-admin-pill border-0 ${STATUS_TONE[t.status] || ""}`}
                    >
                      {BOARD_COLS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`gls-admin-pill ${PRIORITY_TONE[t.priority] || ""}`}
                    >
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gls-muted">
                    {t.requester_email || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase text-gls-muted">
                    {t.source}
                  </td>
                  <td className="px-4 py-3 text-xs text-gls-muted">
                    {new Date(t.updated_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {!tickets.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-16 text-center text-gls-muted"
                  >
                    <p className="gls-display text-3xl text-white/20">Empty queue</p>
                    <p className="mt-2 text-sm">
                      Chat escalations land here as GLS-####. Look for [DEMO] to
                      preview a sample thread.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-4">
          {BOARD_COLS.map((col) => (
            <div
              key={col}
              className="gls-admin-card w-[272px] shrink-0 rounded-lg"
            >
              <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gls-muted">
                  {col.replace("_", " ")}
                </p>
                <span className="gls-admin-pill bg-white/10 text-white">
                  {byCol[col]?.length || 0}
                </span>
              </div>
              <div className="min-h-[120px] space-y-2 p-2">
                {(byCol[col] || []).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => void openTicket(t)}
                    className="w-full rounded-md border border-white/10 bg-black/50 p-3 text-left transition hover:border-gls-red/60 hover:bg-black/70"
                  >
                    <p className="font-mono text-[10px] font-semibold text-gls-red">
                      {t.ticket_number}
                    </p>
                    <p className="mt-1.5 line-clamp-2 text-sm font-medium text-white">
                      {t.subject}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <span
                        className={`gls-admin-pill ${PRIORITY_TONE[t.priority] || ""}`}
                      >
                        {t.priority}
                      </span>
                      <span className="text-[10px] uppercase text-gls-muted">
                        {t.source}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div
          className="gls-admin-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="gls-admin-modal flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Ticket ${selected.ticket_number}`}
          >
            <div className="border-b border-white/10 p-6 pb-4">
              <p className="font-mono text-sm font-semibold text-gls-red">
                {selected.ticket_number}
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                {selected.subject}
              </h3>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <select
                  value={selected.status}
                  onChange={(e) => updateStatus(selected.id, e.target.value)}
                  className={`gls-admin-pill border-0 ${STATUS_TONE[selected.status]}`}
                >
                  {BOARD_COLS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <span
                  className={`gls-admin-pill ${PRIORITY_TONE[selected.priority]}`}
                >
                  {selected.priority}
                </span>
                <span className="gls-admin-pill bg-white/10 text-gls-body">
                  {selected.source}
                </span>
              </div>
              <p className="mt-3 text-xs text-gls-muted">
                {selected.requester_email || "Anonymous"} ·{" "}
                {new Date(selected.created_at).toLocaleString()}
              </p>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto bg-[#0c0c12] p-5">
              {selected.description && (
                <div className="rounded-lg border border-white/10 bg-black/40 p-3 text-sm text-gls-body">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gls-muted">
                    Description
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{selected.description}</p>
                </div>
              )}
              {threadLoading && !messages.length && (
                <p className="text-sm text-gls-muted">Loading thread…</p>
              )}
              {messages.map((m) => {
                const agent = m.author_type === "agent";
                const system = m.author_type === "system";
                return (
                  <div
                    key={m.id}
                    className={`flex ${agent ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        system
                          ? "w-full rounded-md border border-white/10 bg-white/5 text-gls-muted"
                          : agent
                            ? "rounded-br-md bg-gls-pink/20 text-white"
                            : "rounded-bl-md bg-[#1a1a24] text-[#e8e8f0]"
                      }`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gls-muted">
                        {m.author_type}
                        {m.author_email ? ` · ${m.author_email}` : ""} ·{" "}
                        {new Date(m.created_at).toLocaleString()}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-white/10 p-4">
              {threadErr && (
                <p role="alert" className="mb-2 text-sm text-red-300">
                  {threadErr}
                </p>
              )}
              <textarea
                className="gls-admin-input min-h-[80px] w-full"
                placeholder="Agent reply…"
                value={reply}
                disabled={sending}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void sendReply();
                  }
                }}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={sending || threadLoading || !reply.trim()}
                  onClick={() => void sendReply()}
                  className="gls-cta rounded-md px-5 py-2.5 text-sm disabled:opacity-40"
                >
                  {sending ? "Sending…" : "Send reply"}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-white/20 px-4 py-2.5 text-sm text-gls-body"
                  onClick={closeModal}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function HelpdeskBoard() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-gls-muted">Loading helpdesk…</p>}>
      <HelpdeskBoardInner />
    </Suspense>
  );
}

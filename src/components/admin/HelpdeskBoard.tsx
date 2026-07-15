"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

export function HelpdeskBoard() {
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
  const [threadBusy, setThreadBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    const params = new URLSearchParams({ status, priority, source, q });
    const res = await fetch(`/api/admin/helpdesk?${params}`);
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(json.error || "Failed");
      return;
    }
    setTickets(json.tickets || []);
  }, [status, priority, source, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (id: string, next: string) => {
    const res = await fetch("/api/admin/helpdesk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, status: next }),
    });
    if (res.ok) void load();
  };

  const openTicket = async (t: Ticket) => {
    setSelected(t);
    setReply("");
    setThreadBusy(true);
    const res = await fetch(`/api/admin/helpdesk?ticketId=${t.id}`);
    const json = await res.json();
    setThreadBusy(false);
    if (res.ok) {
      setSelected(json.ticket || t);
      setMessages(json.messages || []);
    } else {
      setMessages([]);
    }
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setThreadBusy(true);
    const res = await fetch("/api/admin/helpdesk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reply",
        id: selected.id,
        body: reply.trim(),
      }),
    });
    setThreadBusy(false);
    if (res.ok) {
      setReply("");
      await openTicket(selected);
      void load();
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

  return (
    <div>
      <AdminPageHeader
        eyebrow="Support desk"
        title="Helpdesk"
        description="Jira-style queue — list by default, board for flow. Chat escalations land as GLS-0001…"
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
          {["all", "chat", "email", "manual", "system"].map((s) => (
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
                  <td className="px-4 py-3 text-xs text-gls-muted">
                    {new Date(t.updated_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {!tickets.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-16 text-center text-gls-muted"
                  >
                    <p className="gls-display text-3xl text-white/20">Empty queue</p>
                    <p className="mt-2 text-sm">
                      Chat escalations land here as GLS-####.
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
          onClick={() => setSelected(null)}
        >
          <div
            className="gls-admin-modal flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-white/10 p-6 pb-4">
              <p className="font-mono text-sm font-semibold text-gls-red">
                {selected.ticket_number}
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                {selected.subject}
              </h3>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`gls-admin-pill ${STATUS_TONE[selected.status]}`}>
                  {selected.status}
                </span>
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

            <div className="flex-1 space-y-3 overflow-y-auto p-6">
              {selected.description && (
                <div className="rounded-lg border border-white/10 bg-black/40 p-3 text-sm text-gls-body">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gls-muted">
                    Description
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{selected.description}</p>
                </div>
              )}
              {threadBusy && !messages.length && (
                <p className="text-sm text-gls-muted">Loading thread…</p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-lg border px-3 py-2.5 text-sm ${
                    m.author_type === "agent"
                      ? "border-gls-pink/30 bg-gls-pink/10"
                      : "border-white/10 bg-black/40"
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gls-muted">
                    {m.author_type} · {m.author_email || "—"} ·{" "}
                    {new Date(m.created_at).toLocaleString()}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-white">{m.body}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 p-4">
              <textarea
                className="gls-admin-input min-h-[80px] w-full"
                placeholder="Agent reply…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={threadBusy || !reply.trim()}
                  onClick={() => void sendReply()}
                  className="gls-cta rounded-md px-5 py-2.5 text-sm disabled:opacity-40"
                >
                  {threadBusy ? "Sending…" : "Send reply"}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-white/20 px-4 py-2.5 text-sm text-gls-body"
                  onClick={() => setSelected(null)}
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

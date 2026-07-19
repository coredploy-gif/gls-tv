"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type Enquiry = {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: string;
  internal_notes: string;
  converted_ticket_id: string | null;
  created_at: string;
  updated_at: string;
};

const STATUSES = ["all", "new", "read", "replied", "closed"];

const STATUS_TONE: Record<string, string> = {
  new: "bg-sky-500/15 text-sky-200",
  read: "bg-violet-500/15 text-violet-200",
  replied: "bg-emerald-500/15 text-emerald-200",
  closed: "bg-white/10 text-gls-muted",
};

export function ContactInboxBoard() {
  const [items, setItems] = useState<Enquiry[]>([]);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Enquiry | null>(null);
  const [notes, setNotes] = useState("");
  const [threadBusy, setThreadBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    const params = new URLSearchParams({ status, q });
    const res = await fetch(`/api/admin/inbox?${params}`);
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(json.error || "Failed to load inbox");
      return;
    }
    setItems(json.enquiries || []);
  }, [status, q]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const open = async (row: Enquiry) => {
    setSelected(row);
    setNotes(row.internal_notes || "");
    if (row.status === "new") {
      const res = await fetch("/api/admin/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id: row.id, status: "read" }),
      });
      if (res.ok) {
        const json = await res.json();
        setSelected(json.enquiry);
        void load();
      }
    }
  };

  const save = async (patch: Record<string, unknown>) => {
    if (!selected) return;
    setThreadBusy(true);
    const res = await fetch("/api/admin/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id: selected.id, ...patch }),
    });
    const json = await res.json();
    setThreadBusy(false);
    if (!res.ok) {
      setErr(json.error || "Update failed");
      return;
    }
    setSelected(json.enquiry);
    void load();
  };

  const convert = async () => {
    if (!selected) return;
    setThreadBusy(true);
    const res = await fetch("/api/admin/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "convert_ticket", id: selected.id }),
    });
    const json = await res.json();
    setThreadBusy(false);
    if (!res.ok) {
      setErr(json.error || "Convert failed");
      return;
    }
    void load();
    if (json.ticket?.id) {
      window.location.assign(`/admin/helpdesk?ticket=${json.ticket.id}`);
    }
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Public contact"
        title="Inbox"
        description="Enquiries from /auth Message GLS — separate from signed-in tickets, with convert-to-ticket when useful."
      />

      <div className="gls-admin-card gls-h-scroll gls-h-scroll-row mt-8 rounded-lg p-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter email / name / phone / message"
          className="gls-admin-input min-w-[200px] flex-1"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="gls-admin-input w-auto shrink-0"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              Status: {s}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="shrink-0 rounded-md border border-white/20 px-4 py-2 text-sm text-gls-body transition hover:border-white/40 hover:text-white"
        >
          {busy ? "…" : "Apply"}
        </button>
      </div>

      {err && <p className="mt-3 text-sm text-gls-red">{err}</p>}

      <div className="gls-admin-card gls-h-scroll mt-4 rounded-lg">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-[0.18em] text-gls-muted">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Preview</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer border-t border-white/[0.04] transition hover:bg-gls-red/[0.06]"
                onClick={() => void open(row)}
              >
                <td className="px-4 py-3 text-xs text-gls-muted">
                  {new Date(row.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{row.name || "Guest"}</p>
                  <p className="text-xs text-gls-muted">{row.email}</p>
                </td>
                <td className="px-4 py-3 text-gls-body">{row.phone || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`gls-admin-pill ${STATUS_TONE[row.status] || ""}`}>
                    {row.status}
                  </span>
                  {row.converted_ticket_id && (
                    <span className="ml-2 text-[10px] uppercase text-gls-pink-soft">
                      ticket
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 max-w-[280px] truncate text-gls-muted">
                  {row.message}
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center text-gls-muted">
                  <p className="gls-display text-3xl text-white/20">Empty inbox</p>
                  <p className="mt-2 text-sm">
                    Public messages from /auth appear here.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div
          className="gls-admin-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="gls-admin-modal flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Contact enquiry"
          >
            <div className="border-b border-white/10 p-6 pb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-gls-pink-soft">
                Public enquiry · {selected.status}
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                {selected.name || "Guest"}
              </h3>
              <p className="mt-1 text-sm text-gls-body">
                {selected.email} · {selected.phone || "no phone"}
              </p>
              <p className="mt-2 text-xs text-gls-muted">
                {new Date(selected.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              <div className="rounded-lg border border-white/10 bg-black/40 p-3 text-sm text-white whitespace-pre-wrap">
                {selected.message}
              </div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gls-muted">
                Internal notes
                <textarea
                  className="gls-admin-input mt-2 min-h-[80px] w-full"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-white/10 p-4">
              <button
                type="button"
                disabled={threadBusy}
                onClick={() => void save({ internal_notes: notes })}
                className="rounded-md border border-white/20 px-4 py-2.5 text-sm text-gls-body"
              >
                Save notes
              </button>
              <button
                type="button"
                disabled={threadBusy}
                onClick={() => void save({ status: "replied" })}
                className="rounded-md border border-emerald-400/30 px-4 py-2.5 text-sm text-emerald-200"
              >
                Mark replied
              </button>
              <button
                type="button"
                disabled={threadBusy}
                onClick={() => void save({ status: "closed" })}
                className="rounded-md border border-white/20 px-4 py-2.5 text-sm text-gls-muted"
              >
                Close
              </button>
              <button
                type="button"
                disabled={threadBusy || Boolean(selected.converted_ticket_id)}
                onClick={() => void convert()}
                className="gls-cta rounded-md px-4 py-2.5 text-sm disabled:opacity-40"
              >
                {selected.converted_ticket_id
                  ? "Already converted"
                  : "Convert to ticket"}
              </button>
              {selected.converted_ticket_id && (
                <Link
                  href={`/admin/helpdesk?ticket=${selected.converted_ticket_id}`}
                  className="rounded-md px-4 py-2.5 text-sm text-gls-pink-soft underline"
                >
                  Open ticket
                </Link>
              )}
              <button
                type="button"
                className="ml-auto rounded-md px-4 py-2.5 text-sm text-gls-body"
                onClick={() => setSelected(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

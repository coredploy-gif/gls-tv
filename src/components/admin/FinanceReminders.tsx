"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type Reminder = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  severity: string;
  email: string | null;
  created_at: string;
  dismissed_at: string | null;
};

export function FinanceReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("admin");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [queues, setQueues] = useState<{
    trialsEnding: Array<{ id: string; email: string | null }>;
    pastDue: Array<{ user_id: string }>;
  }>({ trialsEnding: [], pastDue: [] });

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/reminders?active=1");
    const json = await res.json();
    setReminders(json.reminders || []);
    setQueues(json.queues || { trialsEnding: [], pastDue: [] });
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const send = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send",
        email,
        title: title || "GLS TV reminder",
        body,
        kind,
        href: "/pricing",
        severity: kind === "past_due" ? "urgent" : "warn",
      }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? "Sent to member inbox" : json.error || "Failed");
    if (res.ok) {
      setTitle("");
      setBody("");
      void load();
    }
  };

  const nudge = async (queue: "trials" | "past_due") => {
    setBusy(true);
    const res = await fetch("/api/admin/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "nudge_queue", queue }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? `Nudged ${json.sent} members` : json.error || "Failed");
    void load();
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Finance"
        title="In-app reminders"
        description="Push trial / past-due / custom messages into the member notification bell."
      />

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="space-y-4">
          <div className="gls-admin-card space-y-3 rounded-xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-gls-pink">
              Send reminder
            </p>
            <input
              className="gls-admin-input"
              placeholder="member@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <select
              className="gls-admin-input"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="admin">Admin note</option>
              <option value="trial_ending">Trial ending</option>
              <option value="past_due">Past due</option>
              <option value="renewal">Renewal</option>
            </select>
            <input
              className="gls-admin-input"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="gls-admin-input min-h-[88px]"
              placeholder="Message body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <button
              type="button"
              disabled={busy || !email.includes("@")}
              onClick={() => void send()}
              className="gls-cta w-full rounded-md px-4 py-2.5 text-sm disabled:opacity-40"
            >
              {busy ? "Sending…" : "Send in-app"}
            </button>
            {msg && <p className="text-xs text-gls-body">{msg}</p>}
          </div>

          <div className="gls-admin-card space-y-3 rounded-xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-200">
              Bulk queues
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void nudge("trials")}
              className="w-full rounded-md border border-amber-500/30 px-3 py-2 text-left text-sm text-amber-100 hover:bg-amber-500/10"
            >
              Nudge trials ending ≤3d
              <span className="mt-0.5 block text-[11px] text-gls-muted">
                {queues.trialsEnding.length} in queue
              </span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void nudge("past_due")}
              className="w-full rounded-md border border-gls-red/40 px-3 py-2 text-left text-sm text-red-100 hover:bg-gls-red/10"
            >
              Nudge all past due
              <span className="mt-0.5 block text-[11px] text-gls-muted">
                {queues.pastDue.length} in queue
              </span>
            </button>
          </div>
        </div>

        <div className="gls-admin-card overflow-x-auto rounded-xl">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-[0.18em] text-gls-muted">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {reminders.map((r) => (
                <tr key={r.id} className="border-t border-white/[0.04]">
                  <td className="px-4 py-3 text-white">{r.email || r.user_id}</td>
                  <td className="px-4 py-3">
                    <span className="gls-admin-pill bg-white/10 text-gls-body">
                      {r.kind}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-white">{r.title}</p>
                    <p className="line-clamp-1 text-[11px] text-gls-muted">
                      {r.body}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gls-muted">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {!reminders.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-16 text-center text-gls-muted">
                    No active reminders
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

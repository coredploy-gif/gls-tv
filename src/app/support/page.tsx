"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Ticket = {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  updated_at: string;
};
type Message = { id: string; author_type: string; body: string; created_at: string };

function SupportPageBody() {
  const search = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("Loading support…");
  const [busy, setBusy] = useState(false);

  const loadList = async () => {
    const res = await fetch("/api/support", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    setTickets(json.tickets || []);
    setStatus("");
  };
  const openTicket = async (id: string) => {
    const res = await fetch(`/api/support?ticket=${encodeURIComponent(id)}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    setSelected(json.ticket);
    setMessages(json.messages || []);
    window.history.replaceState(null, "", `/support?ticket=${encodeURIComponent(id)}`);
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadList()
        .then(() => {
          const id = search.get("ticket");
          if (id) return openTicket(id);
        })
        .catch((error: Error) => setStatus(error.message));
    });
  }, [search]);

  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    setStatus("Sending…");
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setStatus(json.error || "Request failed");
      return;
    }
    setMessage("");
    setStatus("Saved.");
    await loadList();
    const id = json.ticket?.id || selected?.id;
    if (id) await openTicket(id);
  };

  const create = (event: FormEvent) => {
    event.preventDefault();
    void send({ action: "create", subject, message });
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="gls-display text-4xl text-white">Member support</h1>
      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-gls-pink-soft">{status}</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-2" aria-label="Your tickets">
          {tickets.map((ticket) => (
            <button key={ticket.id} type="button" onClick={() => void openTicket(ticket.id)} className="gls-glass block w-full rounded-lg p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-gls-pink">
              <span className="text-xs text-gls-pink-soft">{ticket.ticket_number} · {ticket.status}</span>
              <span className="mt-1 block text-sm font-medium text-white">{ticket.subject}</span>
            </button>
          ))}
          {!tickets.length && <p className="text-sm text-gls-muted">No tickets yet.</p>}
        </aside>

        <section className="gls-glass rounded-xl p-5">
          {selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-gls-pink-soft">{selected.ticket_number}</p>
                  <h2 className="text-xl font-semibold text-white">{selected.subject}</h2>
                </div>
                <button disabled={busy} className="rounded border border-white/20 px-3 py-1.5 text-sm text-white" onClick={() => void send({ action: selected.status === "closed" ? "reopen" : "close", ticketId: selected.id })}>
                  {selected.status === "closed" ? "Reopen" : "Close"}
                </button>
              </div>
              <div className="mt-5 space-y-3" aria-label="Ticket messages">
                {messages.map((item) => {
                  const mine = item.author_type === "user";
                  const system = item.author_type === "system";
                  return (
                    <article
                      key={item.id}
                      className={`rounded-2xl p-3 ${
                        system
                          ? "border border-white/10 bg-white/5"
                          : mine
                            ? "ml-6 bg-gls-pink/20"
                            : "mr-6 bg-white/5"
                      }`}
                    >
                      <p className="text-xs uppercase text-gls-muted">
                        {item.author_type === "agent" ? "GLS Support" : item.author_type} ·{" "}
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-white">{item.body}</p>
                    </article>
                  );
                })}
              </div>
              {selected.status !== "closed" && (
                <form className="mt-5" onSubmit={(event) => { event.preventDefault(); void send({ action: "reply", ticketId: selected.id, message }); }}>
                  <label className="block text-sm text-gls-body">
                    Reply
                    <textarea required className="gls-admin-input mt-1 min-h-28" value={message} onChange={(e) => setMessage(e.target.value)} />
                  </label>
                  <button disabled={busy} className="gls-cta mt-3 rounded px-4 py-2 text-sm">Send reply</button>
                </form>
              )}
            </>
          ) : (
            <form onSubmit={create}>
              <h2 className="text-xl font-semibold text-white">Create a ticket</h2>
              <label className="mt-4 block text-sm text-gls-body">
                Subject
                <input required minLength={3} className="gls-admin-input mt-1" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </label>
              <label className="mt-3 block text-sm text-gls-body">
                Details
                <textarea required minLength={10} className="gls-admin-input mt-1 min-h-36" value={message} onChange={(e) => setMessage(e.target.value)} />
              </label>
              <button disabled={busy} className="gls-cta mt-4 rounded px-4 py-2 text-sm">Create ticket</button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

export default function SupportPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-6xl px-4 py-10 text-gls-muted">
          Loading support…
        </main>
      }
    >
      <SupportPageBody />
    </Suspense>
  );
}

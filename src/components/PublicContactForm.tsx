"use client";

import { FormEvent, useState } from "react";

export function PublicContactForm({ onClose }: { onClose?: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          message,
          website: honeypot,
        }),
      });
      const json = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(json.error || "Could not send message");
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-center"
      >
        <p className="text-lg font-semibold text-white">Message sent</p>
        <p className="mt-2 text-sm text-emerald-100">
          GLS will get back to you as soon as possible.
        </p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 text-sm font-semibold text-white underline"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <p className="text-sm text-[#c4c4d4]">
        New customer or need to complain? Leave your details — no sign-in required.
      </p>
      {/* honeypot */}
      <label className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        Company
        <input
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </label>
      <label className="block text-xs font-semibold uppercase tracking-wide text-[#a8a8b8]">
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/15 bg-[#0e0e14] px-3 py-2.5 text-sm text-white outline-none focus:border-gls-pink/50"
          maxLength={120}
          name="name"
          autoComplete="name"
        />
      </label>
      <label className="block text-xs font-semibold uppercase tracking-wide text-[#a8a8b8]">
        Email *
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/15 bg-[#0e0e14] px-3 py-2.5 text-sm text-white outline-none focus:border-gls-pink/50"
          maxLength={200}
          name="email"
          autoComplete="email"
        />
      </label>
      <label className="block text-xs font-semibold uppercase tracking-wide text-[#a8a8b8]">
        Contact number *
        <input
          required
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/15 bg-[#0e0e14] px-3 py-2.5 text-sm text-white outline-none focus:border-gls-pink/50"
          maxLength={40}
          name="phone"
          autoComplete="tel"
          placeholder="+27…"
        />
      </label>
      <label className="block text-xs font-semibold uppercase tracking-wide text-[#a8a8b8]">
        Message *
        <textarea
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1 min-h-[110px] w-full rounded-lg border border-white/15 bg-[#0e0e14] px-3 py-2.5 text-sm text-white outline-none focus:border-gls-pink/50"
          maxLength={4000}
          name="message"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="gls-cta rounded-lg px-5 py-2.5 text-sm font-bold disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send message"}
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/20 px-4 py-2.5 text-sm text-[#c4c4d4]"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

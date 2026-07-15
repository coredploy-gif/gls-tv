"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function PasswordResetPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const res = await fetch("/api/account/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const json = await res.json();
    setBusy(false);
    setStatus(json.message || "If that address has an account, a recovery link has been sent.");
  };

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12">
      <form onSubmit={submit} className="gls-glass w-full rounded-xl p-6">
        <h1 className="gls-display text-3xl text-white">Reset password</h1>
        <label className="mt-5 block text-sm text-gls-body">
          Account email
          <input required type="email" autoComplete="email" className="gls-admin-input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button disabled={busy} className="gls-cta mt-4 w-full rounded py-2.5 disabled:opacity-50">
          {busy ? "Sending…" : "Send recovery link"}
        </button>
        <p role="status" aria-live="polite" className="mt-3 text-sm text-gls-body">{status}</p>
        <Link href="/auth" className="mt-4 inline-block text-sm text-gls-pink-soft">Back to sign in</Link>
      </form>
    </main>
  );
}

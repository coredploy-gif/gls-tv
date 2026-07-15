"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function RecoverAccountPage() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setStatus("Updating password…");
    const res = await fetch("/api/account/password-reset", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const json = await res.json();
    setBusy(false);
    setStatus(res.ok ? "Password updated. You can continue to your account." : json.error || "Password could not be updated.");
  };

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12">
      <form onSubmit={submit} className="gls-glass w-full rounded-xl p-6">
        <h1 className="gls-display text-3xl text-white">Set a new password</h1>
        <label className="mt-5 block text-sm text-gls-body">
          New password
          <input required minLength={8} type="password" autoComplete="new-password" className="gls-admin-input mt-1" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button disabled={busy} className="gls-cta mt-4 w-full rounded py-2.5 disabled:opacity-50">
          {busy ? "Updating…" : "Update password"}
        </button>
        <p role="status" aria-live="polite" className="mt-3 text-sm text-gls-body">{status}</p>
        <Link href="/account" className="mt-4 inline-block text-sm text-gls-pink-soft">Back to account</Link>
      </form>
    </main>
  );
}

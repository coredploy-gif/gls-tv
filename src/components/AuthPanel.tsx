"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

type Mode = "signin" | "signup";

const DEFAULT_POST_LOGIN_HREF = "/profiles";

function safeNextPath(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export function AuthPanel({
  onDone,
  compact = false,
}: {
  onDone?: () => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithPassword, signUpWithPassword, user, loading, signOut } =
    useAuth();
  const [mode, setMode] = useState<Mode>(
    searchParams.get("mode") === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const goAfterLogin = () => {
    onDone?.();
    const next =
      safeNextPath(searchParams.get("next")) ?? DEFAULT_POST_LOGIN_HREF;
    router.replace(next);
  };

  if (loading) {
    return (
      <p className="text-sm text-gls-muted">Checking your account…</p>
    );
  }

  if (user) {
    return (
      <div
        className={`flex flex-wrap items-center gap-3 ${compact ? "" : "rounded-sm border border-white/10 bg-white/[0.03] p-4"}`}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">Signed in</p>
          <p className="truncate text-sm text-gls-body">
            {user.email || user.id}
          </p>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded border border-white/20 px-3 py-1.5 text-sm text-gls-body transition hover:border-white hover:text-white"
        >
          Sign out
        </button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const action =
      mode === "signin" ? signInWithPassword : signUpWithPassword;
    const err = await action(email, password);
    setBusy(false);
    if (err) {
      setError("We couldn’t sign you in with those details. Please check them and try again.");
      return;
    }
    if (mode === "signup") {
      setInfo(
        "Check your email for a verification link, then sign in. You’ll pick who’s watching next. One free 14-day trial per device.",
      );
      setMode("signin");
      return;
    }
    goAfterLogin();
  };

  return (
    <div
      className={
        compact
          ? ""
          : "rounded-sm border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-5 sm:p-6"
      }
    >
      {!compact && (
        <>
          <h2 className="gls-display text-3xl text-white">Account</h2>
          <p className="mt-2 max-w-xl text-sm text-gls-body">
            Sign in or register with a valid email. After verify, choose who’s
            watching — then Home.
          </p>
        </>
      )}

      <div className={`${compact ? "" : "mt-5"} flex gap-2`}>
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`rounded px-3 py-1.5 text-sm font-medium transition ${
            mode === "signin"
              ? "bg-white text-black"
              : "bg-white/10 text-gls-body hover:bg-white/15"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`rounded px-3 py-1.5 text-sm font-medium transition ${
            mode === "signup"
              ? "bg-white text-black"
              : "bg-white/10 text-gls-body hover:bg-white/15"
          }`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gls-muted">
            Email
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full rounded-sm border border-white/15 bg-black/50 px-4 py-3 text-white outline-none ring-gls-red placeholder:text-white/30 focus:border-gls-red focus:ring-1"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gls-muted">
            Password
          </span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="w-full rounded-sm border border-white/15 bg-black/50 px-4 py-3 text-white outline-none ring-gls-red placeholder:text-white/30 focus:border-gls-red focus:ring-1"
          />
        </label>
        {error && (
          <p className="rounded bg-gls-red/20 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
        {info && (
          <p className="rounded bg-emerald-900/40 px-3 py-2 text-sm text-emerald-200">
            {info}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="gls-cta w-full rounded py-3 text-base font-semibold disabled:opacity-60"
        >
          {busy
            ? "Please wait…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>
    </div>
  );
}

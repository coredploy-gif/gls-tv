"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useAppCopy } from "@/lib/useAppCopy";

type Mode = "signin" | "signup";

const DEFAULT_POST_LOGIN_HREF = "/profiles";

function safeNextPath(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

function PasswordField({
  mode,
  password,
  setPassword,
}: {
  mode: Mode;
  password: string;
  setPassword: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gls-muted">
        Password
      </span>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          required
          minLength={6}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          className="w-full rounded-sm border border-white/15 bg-black/50 px-4 py-3 pr-24 text-white outline-none ring-gls-red placeholder:text-white/30 focus:border-gls-red focus:ring-1"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-semibold text-gls-muted hover:text-white"
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </label>
  );
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
  const copy = useAppCopy();
  const [mode, setMode] = useState<Mode>(
    searchParams.get("mode") === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [signupsAllowed, setSignupsAllowed] = useState(true);
  const [signupFreezeMsg, setSignupFreezeMsg] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/auth/signup-status", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setSignupsAllowed(data.allowed !== false);
        setSignupFreezeMsg(data.message || null);
      })
      .catch(() => undefined);
  }, []);

  const goAfterLogin = () => {
    onDone?.();
    const next =
      safeNextPath(searchParams.get("next")) ?? DEFAULT_POST_LOGIN_HREF;
    router.replace(next);
  };

  if (loading) {
    return <p className="text-sm text-gls-muted">Checking your account…</p>;
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

    if (mode === "signup") {
      if (!signupsAllowed) {
        setBusy(false);
        setError(signupFreezeMsg || copy("auth.error.signups_paused"));
        return;
      }
      const status = await fetch("/api/auth/signup-status", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => ({ allowed: true }));
      if (status.allowed === false) {
        setBusy(false);
        setError(status.message || copy("auth.error.signups_paused"));
        return;
      }
    }

    const action = mode === "signin" ? signInWithPassword : signUpWithPassword;
    const err = await action(email, password);
    setBusy(false);
    if (err) {
      const lower = err.toLowerCase();
      if (lower.includes("leak") || lower.includes("pwned") || lower.includes("breach")) {
        setError(copy("auth.error.breached_password"));
      } else if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
        setError(copy("auth.error.invalid_credentials"));
      } else {
        setError(err);
      }
      return;
    }
    if (mode === "signup") {
      setInfo(copy("auth.info.verify_email"));
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
            watching — then Home. Use Show to confirm your password as you type.
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
          disabled={!signupsAllowed}
          className={`rounded px-3 py-1.5 text-sm font-medium transition disabled:opacity-40 ${
            mode === "signup"
              ? "bg-white text-black"
              : "bg-white/10 text-gls-body hover:bg-white/15"
          }`}
        >
          Create account
        </button>
      </div>

      {!signupsAllowed && (
        <p className="mt-3 rounded bg-amber-500/15 px-3 py-2 text-sm text-amber-100">
          {signupFreezeMsg || "New registrations are temporarily paused."}
        </p>
      )}

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
        {mode === "signup" && (
          <label className="flex items-start gap-2 text-xs leading-relaxed text-gls-body">
            <input
              type="checkbox"
              required
              checked={acceptedPolicies}
              onChange={(event) => setAcceptedPolicies(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              I agree to the{" "}
              <Link href="/legal#terms" className="text-white underline">
                Terms
              </Link>
              ,{" "}
              <Link href="/legal#privacy" className="text-white underline">
                Privacy/POPIA notice
              </Link>
              , trial/device rules and kids-profile terms.
            </span>
          </label>
        )}
        <PasswordField mode={mode} password={password} setPassword={setPassword} />
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
          disabled={busy || (mode === "signup" && (!acceptedPolicies || !signupsAllowed))}
          className="gls-cta mt-1 w-full rounded py-3 text-sm font-semibold disabled:opacity-50"
        >
          {busy
            ? "Please wait…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>
        {mode === "signin" && (
          <p className="text-center text-xs text-gls-muted">
            <Link href="/auth/reset" className="underline hover:text-white">
              Forgot password?
            </Link>
          </p>
        )}
      </form>
    </div>
  );
}

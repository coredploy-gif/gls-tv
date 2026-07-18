"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Provider, Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/auth/safe-next";

export type OAuthProvider = Extract<Provider, "google" | "apple">;

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  adminLoading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  signUpWithPassword: (
    email: string,
    password: string,
  ) => Promise<string | null>;
  signInWithOAuth: (
    provider: OAuthProvider,
    options?: { next?: string },
  ) => Promise<string | null>;
  signInWithGoogle: (options?: { next?: string }) => Promise<string | null>;
  signInWithApple: (options?: { next?: string }) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminStatus, setAdminStatus] = useState<{
    accessToken: string | null;
    isAdmin: boolean;
  }>({ accessToken: null, isAdmin: false });

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (mounted) setSession(data.session);
      } catch {
        if (mounted) setSession(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    const accessToken = session?.access_token;

    if (!accessToken) return;

    void fetch("/api/admin/session", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) return false;
        const data = (await response.json()) as { isAdmin?: boolean };
        return data.isAdmin === true;
      })
      .catch(() => false)
      .then((allowed) => {
        if (!cancelled) setAdminStatus({ accessToken, isAdmin: allowed });
      });

    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  const currentAccessToken = session?.access_token ?? null;
  const isAdmin =
    currentAccessToken !== null &&
    adminStatus.accessToken === currentAccessToken &&
    adminStatus.isAdmin;
  const adminLoading =
    currentAccessToken !== null && adminStatus.accessToken !== currentAccessToken;

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      return error?.message ?? null;
    },
    [supabase],
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string) => {
      const origin = (
        process.env.NEXT_PUBLIC_SITE_URL ||
        (typeof window !== "undefined" ? window.location.origin : "") ||
        "http://127.0.0.1:3010"
      ).replace(/\/$/, "");
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });
      return error?.message ?? null;
    },
    [supabase],
  );

  const signInWithOAuth = useCallback(
    async (provider: OAuthProvider, options?: { next?: string }) => {
      const origin = (
        process.env.NEXT_PUBLIC_SITE_URL ||
        (typeof window !== "undefined" ? window.location.origin : "") ||
        "http://127.0.0.1:3010"
      ).replace(/\/$/, "");
      const next = safeNextPath(options?.next);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      return error?.message ?? null;
    },
    [supabase],
  );

  const signInWithGoogle = useCallback(
    (options?: { next?: string }) => signInWithOAuth("google", options),
    [signInWithOAuth],
  );

  const signInWithApple = useCallback(
    (options?: { next?: string }) => signInWithOAuth("apple", options),
    [signInWithOAuth],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      isAdmin,
      adminLoading,
      signInWithPassword,
      signUpWithPassword,
      signInWithOAuth,
      signInWithGoogle,
      signInWithApple,
      signOut,
    }),
    [
      session,
      loading,
      isAdmin,
      adminLoading,
      signInWithPassword,
      signUpWithPassword,
      signInWithOAuth,
      signInWithGoogle,
      signInWithApple,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type Assignment = { user_id: string; email: string | null; role: string; revoked_at: string | null };
type Flag = { key: string; enabled: boolean; reason: string | null };

const FLAG_LABELS: Record<string, { title: string; note?: string }> = {
  payments: { title: "Payments" },
  playlist_imports: { title: "Playlist imports" },
  hls_proxy: { title: "HLS proxy" },
  catalog_publish: { title: "Catalog publish" },
  signups: {
    title: "New signups",
    note: "Turn off to freeze new email registrations.",
  },
  oauth_google: {
    title: "Enable Google sign-in",
    note: "Shows the Google button on /auth. Supabase Authentication → Providers → Google must also be configured, or users will see an error after clicking.",
  },
  oauth_apple: {
    title: "Enable Apple sign-in (deferred)",
    note: "Reserved for later. Apple is not shown in the auth UI while this is off (Apple Developer not ready).",
  },
};

export default function AdminAccessPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("support");
  const [status, setStatus] = useState("Loading access review…");

  const load = async () => {
    const res = await fetch("/api/admin/access", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    setAssignments(json.assignments || []);
    setFlags(json.flags || []);
    setStatus(json.current.aal === "aal2" ? "" : "Sensitive changes require verified MFA (AAL2).");
  };
  useEffect(() => {
    queueMicrotask(() => {
      void load().catch((error: Error) => setStatus(error.message));
    });
  }, []);

  const act = async (body: Record<string, unknown>) => {
    setStatus("Applying audited change…");
    const res = await fetch("/api/admin/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setStatus(res.ok ? "Change applied." : json.error || "Change failed.");
    if (res.ok) await load();
  };

  return (
    <div>
      <AdminPageHeader eyebrow="Security" title="Roles & emergency controls" description="Database-backed least-privilege roles, quarterly access review and audited feature kill switches." />
      <p role="status" aria-live="polite" className="mt-4 min-h-5 text-sm text-amber-200">{status}</p>
      <section className="gls-admin-card mt-6 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white">Grant role</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <input className="gls-admin-input max-w-sm" type="email" placeholder="Existing member email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className="gls-admin-input max-w-40" value={role} onChange={(e) => setRole(e.target.value)}>
            {["owner", "finance", "support", "catalog", "ops"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <button className="gls-cta rounded px-4 py-2 text-sm" onClick={() => void act({ action: "grant_role", email, role })}>Grant</button>
        </div>
        <div className="mt-5 space-y-2">
          {assignments.filter((item) => !item.revoked_at).map((item) => (
            <div key={`${item.user_id}:${item.role}`} className="flex flex-wrap items-center justify-between gap-3 rounded border border-white/10 p-3 text-sm">
              <span className="text-white">{item.email || item.user_id} · {item.role}</span>
              <button className="text-red-200 underline" onClick={() => void act({ action: "revoke_role", email: item.email, role: item.role })}>Revoke</button>
            </div>
          ))}
        </div>
      </section>
      <section className="gls-admin-card mt-6 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white">Feature kill switches</h2>
        <p className="mt-1 text-xs text-gls-muted">
          Disabling is fail-closed in protected server routes. Turn off{" "}
          <strong className="text-white/80">signups</strong> to freeze new
          registrations; <strong className="text-white/80">oauth_google</strong>{" "}
          defaults off (email-only until you enable Google). PayFast/EFT also
          toggle under Finance → Settings.
        </p>
        <div className="mt-4 space-y-2">
          {flags.map((flag) => {
            const label = FLAG_LABELS[flag.key];
            return (
              <div key={flag.key} className="flex items-center justify-between gap-3 rounded border border-white/10 p-3">
                <div>
                  <p className="text-sm text-white">{label?.title || flag.key}</p>
                  <p className="text-xs text-gls-muted">
                    {label?.note || flag.reason || flag.key}
                  </p>
                </div>
                <button
                  className={`shrink-0 rounded px-3 py-1.5 text-xs ${flag.enabled ? "bg-emerald-600 text-white" : "bg-red-700 text-white"}`}
                  onClick={() =>
                    void act({
                      action: "set_feature",
                      key: flag.key,
                      enabled: !flag.enabled,
                      reason: `Changed from admin access review`,
                    })
                  }
                >
                  {flag.enabled ? "Enabled" : "Disabled"}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

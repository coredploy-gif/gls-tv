"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type Right = {
  id: string;
  channel_id: string | null;
  stream_seed_slug: string | null;
  source_name: string;
  rights_holder: string | null;
  status: string;
  expires_at: string | null;
};

export default function AdminRightsPage() {
  const [rights, setRights] = useState<Right[]>([]);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({
    channelId: "",
    sourceName: "",
    rightsHolder: "",
    evidenceReference: "",
    territories: "ZA",
    expiresAt: "",
    reviewAt: "",
    commercialUse: false,
    redistribution: false,
    proxyPermission: false,
    rightsStatus: "pending",
  });
  const load = async () => {
    const res = await fetch("/api/admin/rights", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    setRights(json.rights || []);
  };
  useEffect(() => {
    queueMicrotask(() => {
      void load().catch((error: Error) => setStatus(error.message));
    });
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus("Saving audited rights record…");
    const res = await fetch("/api/admin/rights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        status: form.rightsStatus,
        territories: form.territories.split(",").map((item) => item.trim()).filter(Boolean),
      }),
    });
    const json = await res.json();
    setStatus(res.ok ? "Rights record saved." : json.error || "Save failed.");
    if (res.ok) await load();
  };
  return (
    <div>
      <AdminPageHeader eyebrow="Catalog governance" title="Source rights" description="No source is approved by default. Publishing requires approved, unexpired commercial, redistribution and proxy rights." />
      <p role="status" aria-live="polite" className="mt-4 min-h-5 text-sm text-amber-200">{status}</p>
      <form onSubmit={submit} className="gls-admin-card mt-5 grid gap-3 rounded-xl p-5 md:grid-cols-2">
        <input required className="gls-admin-input" placeholder="Catalog channel ID" value={form.channelId} onChange={(e) => setForm({ ...form, channelId: e.target.value })} />
        <input required className="gls-admin-input" placeholder="Source / licensor" value={form.sourceName} onChange={(e) => setForm({ ...form, sourceName: e.target.value })} />
        <input className="gls-admin-input" placeholder="Rights holder" value={form.rightsHolder} onChange={(e) => setForm({ ...form, rightsHolder: e.target.value })} />
        <input className="gls-admin-input" placeholder="Evidence reference (no secrets)" value={form.evidenceReference} onChange={(e) => setForm({ ...form, evidenceReference: e.target.value })} />
        <input className="gls-admin-input" placeholder="Territories, comma-separated" value={form.territories} onChange={(e) => setForm({ ...form, territories: e.target.value })} />
        <input type="date" className="gls-admin-input" aria-label="Expiry date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
        {(["commercialUse", "redistribution", "proxyPermission"] as const).map((key) => (
          <label key={key} className="flex items-center gap-2 text-sm text-gls-body"><input type="checkbox" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />{key}</label>
        ))}
        <select className="gls-admin-input" value={form.rightsStatus} onChange={(e) => setForm({ ...form, rightsStatus: e.target.value })}>
          {["unknown", "pending", "approved", "expired", "revoked", "takedown"].map((item) => <option key={item}>{item}</option>)}
        </select>
        <button className="gls-cta rounded px-4 py-2 text-sm">Save rights record</button>
      </form>
      <div className="mt-6 space-y-2">
        {rights.map((right) => (
          <div key={right.id} className="gls-admin-card rounded-lg p-3 text-sm">
            <p className="text-white">{right.channel_id || right.stream_seed_slug} · {right.status}</p>
            <p className="text-xs text-gls-muted">{right.source_name} · {right.rights_holder || "holder unknown"}{right.expires_at ? ` · expires ${new Date(right.expires_at).toLocaleDateString()}` : ""}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

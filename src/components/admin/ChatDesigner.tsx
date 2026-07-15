"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type Config = {
  welcome_title: string;
  welcome_body: string;
  primary_color: string;
  position: string;
  show_kb_first: boolean;
  ask_human_label: string;
  offline_message: string;
  is_enabled: boolean;
};

type KbHit = { id: string; title: string; summary: string; slug: string };

export function ChatDesigner() {
  const [config, setConfig] = useState<Config | null>(null);
  const [previewQ, setPreviewQ] = useState("");
  const [hits, setHits] = useState<KbHit[]>([]);
  const [ticketMsg, setTicketMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/chat-config")
      .then((r) => r.json())
      .then((j) => setConfig(j.config));
  }, []);

  useEffect(() => {
    if (!previewQ.trim()) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/admin/knowledge?q=${encodeURIComponent(previewQ)}`)
        .then((r) => r.json())
        .then((j) => setHits((j.articles || []).slice(0, 4)));
    }, 250);
    return () => clearTimeout(t);
  }, [previewQ]);

  const previewStyle = useMemo(
    () => ({
      borderColor: config?.primary_color || "#e50914",
      boxShadow: `0 0 40px ${config?.primary_color || "#e50914"}22`,
    }),
    [config],
  );

  if (!config) {
    return (
      <div className="flex justify-center py-20">
        <div className="gls-buffer-ring" />
      </div>
    );
  }

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await fetch("/api/admin/chat-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const escalate = async () => {
    const res = await fetch("/api/admin/helpdesk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_from_chat",
        subject: previewQ || "Support request",
        description: previewQ || "User requested a human from live chat.",
      }),
    });
    const json = await res.json();
    if (res.ok) {
      setTicketMsg(
        `${config.offline_message} Ticket ${json.ticketNumber || json.ticket?.ticket_number}.`,
      );
    }
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Guest experience"
        title="Live chat"
        description="Designer + live preview. Chat searches the knowledge base first; human support creates a GLS-#### ticket when agents are offline."
        actions={
          <span
            className={`gls-admin-pill ${
              config.is_enabled
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-white/10 text-gls-muted"
            }`}
          >
            <span
              className={
                config.is_enabled ? "gls-admin-live-dot" : "h-1.5 w-1.5 rounded-full bg-gls-muted"
              }
            />
            {config.is_enabled ? "Live on site" : "Disabled"}
          </span>
        }
      />

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="gls-admin-card space-y-4 rounded-lg p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-gls-red">
            Designer
          </p>
          {(
            [
              ["welcome_title", "Welcome title"],
              ["welcome_body", "Welcome body"],
              ["ask_human_label", "Ask human label"],
              ["offline_message", "Offline / ticket message"],
              ["primary_color", "Primary color"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-xs font-medium text-gls-muted">
              {label}
              <div className="mt-1.5 flex gap-2">
                <input
                  className="gls-admin-input"
                  value={String(config[key] ?? "")}
                  onChange={(e) =>
                    setConfig({ ...config, [key]: e.target.value })
                  }
                />
                {key === "primary_color" && (
                  <input
                    type="color"
                    value={config.primary_color}
                    onChange={(e) =>
                      setConfig({ ...config, primary_color: e.target.value })
                    }
                    className="h-10 w-12 cursor-pointer rounded border border-white/15 bg-transparent"
                  />
                )}
              </div>
            </label>
          ))}

          <div className="space-y-3 border-t border-white/10 pt-4">
            <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-gls-body">
              <span>Knowledge base first</span>
              <input
                type="checkbox"
                checked={config.show_kb_first}
                onChange={(e) =>
                  setConfig({ ...config, show_kb_first: e.target.checked })
                }
                className="h-4 w-4 accent-[#e50914]"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-gls-body">
              <span>Widget enabled on site</span>
              <input
                type="checkbox"
                checked={config.is_enabled}
                onChange={(e) =>
                  setConfig({ ...config, is_enabled: e.target.checked })
                }
                className="h-4 w-4 accent-[#e50914]"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={save}
            className="gls-cta w-full rounded-md px-4 py-2.5 text-sm"
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save widget"}
          </button>
        </div>

        <div
          className="gls-admin-card relative overflow-hidden rounded-lg border-2 p-6"
          style={previewStyle}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              background: `radial-gradient(ellipse at top right, ${config.primary_color}55, transparent 55%)`,
            }}
          />
          <p className="relative text-[10px] font-bold uppercase tracking-[0.28em] text-gls-muted">
            Live preview
          </p>

          <div className="relative mt-5 overflow-hidden rounded-lg border border-white/10 bg-[#0d0d0d] shadow-2xl">
            <div
              className="px-4 py-4 text-white"
              style={{
                background: `linear-gradient(135deg, ${config.primary_color}, ${config.primary_color}cc)`,
              }}
            >
              <p className="text-base font-semibold">{config.welcome_title}</p>
              <p className="mt-1 text-xs leading-relaxed opacity-90">
                {config.welcome_body}
              </p>
            </div>
            <div className="p-4">
              <input
                value={previewQ}
                onChange={(e) => setPreviewQ(e.target.value)}
                placeholder="Ask about GLS TV…"
                className="gls-admin-input"
              />
              {config.show_kb_first && hits.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gls-muted">
                    From knowledge base
                  </p>
                  {hits.map((h) => (
                    <div
                      key={h.id}
                      className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2.5 transition hover:border-white/20"
                    >
                      <p className="text-sm font-medium text-white">{h.title}</p>
                      <p className="mt-0.5 text-xs text-gls-muted">{h.summary}</p>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={escalate}
                className="mt-4 w-full rounded-md px-3 py-2.5 text-sm font-bold text-white transition hover:brightness-110"
                style={{ background: config.primary_color }}
              >
                {config.ask_human_label}
              </button>
              {ticketMsg && (
                <p className="mt-3 rounded-md bg-emerald-500/10 px-3 py-2 text-xs leading-relaxed text-emerald-300">
                  {ticketMsg}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

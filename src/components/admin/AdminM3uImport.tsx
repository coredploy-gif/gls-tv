"use client";

import { useState } from "react";

type PreviewChannel = {
  index: number;
  title: string;
  group: string;
  tvgId: string | null;
};

export function AdminM3uImport() {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [channels, setChannels] = useState<PreviewChannel[]>([]);
  const [targets, setTargets] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const request = async (payload: object) => {
    const response = await fetch("/api/admin/m3u-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const preview = async () => {
    setBusy(true);
    setStatus("Fetching and parsing approved source…");
    try {
      const data = await request({ action: "preview", url });
      setToken(data.token);
      setChannels(data.channels || []);
      setStatus(
        `Preview ready: ${data.stats.parsed} parsed, ${data.stats.invalid} invalid, ${data.stats.duplicates} duplicates. Map only channels you are authorized to publish.`,
      );
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    const mappings = Object.entries(targets)
      .filter(([, slug]) => slug.trim())
      .map(([index, targetSlug]) => ({ index: Number(index), targetSlug }));
    setBusy(true);
    setStatus("Publishing mapped streams…");
    try {
      const data = await request({ action: "publish", token, mappings });
      setStatus(`${data.message} Published: ${data.published.join(", ")}.`);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Import approved M3U channel list</h2>
        <p className="mt-1 text-sm text-gls-muted">
          Separate from Staff picks. Accepts approved multi-channel M3U lists and
          single HLS streams on the media host allowlist (e.g. jmp2.uk → Roku).
          Previewing never publishes. Each selected channel must map to an existing
          catalog slug.
        </p>
      </div>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Approved HTTPS .m3u URL"
          className="gls-admin-input flex-1"
        />
        <button
          type="button"
          disabled={busy || !url.trim()}
          onClick={() => void preview()}
          className="rounded border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Preview
        </button>
      </div>
      {channels.length > 0 && (
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {channels.map((channel) => (
            <label key={channel.index} className="grid gap-2 rounded border border-white/10 p-3 sm:grid-cols-2">
              <span className="text-sm text-white">
                {channel.title}
                <span className="ml-2 text-xs text-gls-muted">{channel.group}</span>
              </span>
              <input
                value={targets[channel.index] || ""}
                onChange={(event) =>
                  setTargets((current) => ({
                    ...current,
                    [channel.index]: event.target.value,
                  }))
                }
                placeholder="existing-catalog-slug (blank = skip)"
                className="gls-admin-input"
              />
            </label>
          ))}
        </div>
      )}
      {channels.length > 0 && (
        <button
          type="button"
          disabled={busy || !Object.values(targets).some((slug) => slug.trim())}
          onClick={() => void publish()}
          className="gls-cta rounded px-5 py-2.5 text-sm disabled:opacity-50"
        >
          Publish mapped streams
        </button>
      )}
      <p aria-live="polite" className="text-sm text-gls-body">
        {status}
      </p>
    </section>
  );
}

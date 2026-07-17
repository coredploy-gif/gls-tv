"use client";

import { useState } from "react";

type PreviewChannel = {
  index: number;
  title: string;
  group: string;
  tvgId: string | null;
  url: string;
};

export function AdminM3uImport() {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [channels, setChannels] = useState<PreviewChannel[]>([]);
  const [targets, setTargets] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [singleStream, setSingleStream] = useState(false);
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
    setStatus("Fetching and parsing source…");
    setTargets({});
    setSelected({});
    try {
      const data = await request({ action: "preview", url });
      const nextChannels = (data.channels || []) as PreviewChannel[];
      setToken(data.token);
      setChannels(nextChannels);
      setSingleStream(Boolean(data.singleStream));
      const defaults: Record<number, boolean> = {};
      for (const channel of nextChannels) {
        defaults[channel.index] = Boolean(data.singleStream);
      }
      setSelected(defaults);
      setStatus(
        data.note ||
          `Preview ready: ${data.stats.parsed} parsed, ${data.stats.invalid} invalid, ${data.stats.duplicates} duplicates.`,
      );
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const publishCatalog = async () => {
    const mappings = Object.entries(targets)
      .filter(([, slug]) => slug.trim())
      .map(([index, targetSlug]) => ({ index: Number(index), targetSlug }));
    setBusy(true);
    setStatus("Publishing mapped streams to the licensed catalog…");
    try {
      const data = await request({ action: "publish", token, mappings });
      setStatus(`${data.message} Published: ${data.published.join(", ")}.`);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  };

  const saveStaffPicks = async (publish: boolean) => {
    const picks = channels.filter((channel) => selected[channel.index] && channel.url);
    if (!picks.length) {
      setStatus("Select at least one stream to save as a Staff pick.");
      return;
    }
    if (publish) {
      const ok = window.confirm(
        `Publish ${picks.length} stream(s) to My Links → Staff picks?\n\nThis is for individual member streams — not the licensed catalog. No catalog MFA required.`,
      );
      if (!ok) return;
    }
    setBusy(true);
    setStatus(
      publish
        ? "Saving and publishing Staff picks…"
        : "Saving Staff pick drafts…",
    );
    try {
      const saved: string[] = [];
      for (const channel of picks) {
        const response = await fetch("/api/admin/media-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: channel.url,
            title: channel.title,
            category: channel.group || "Live TV",
            notes: `Imported from M3U preview (${url.trim().slice(0, 120)})`,
            is_published: publish,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            data.error || `Failed to save “${channel.title}” as Staff pick`,
          );
        }
        saved.push(data.link?.title || channel.title);
      }
      setStatus(
        publish
          ? `Published ${saved.length} Staff pick(s) on My Links → Staff picks: ${saved.join(", ")}.`
          : `Drafted ${saved.length} Staff pick(s). Open Staff media picks above to Confirm publish.`,
      );
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Staff pick save failed");
    } finally {
      setBusy(false);
    }
  };

  const selectedCount = channels.filter((channel) => selected[channel.index]).length;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Import approved M3U / HLS</h2>
        <p className="mt-1 text-sm text-gls-muted">
          Preview never publishes. For{" "}
          <strong className="text-white/80">individual</strong> streams members
          should use (jmp2, public-IP HLS, etc.), prefer{" "}
          <strong className="text-white/80">Save as Staff picks</strong> — same
          path as Staff media picks above (My Links), no catalog MFA.{" "}
          <strong className="text-white/80">Publish mapped streams</strong> is
          only for the licensed catalog (map to existing slugs; needs catalog
          permission + verified MFA).
        </p>
      </div>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://…m3u8 or approved .m3u list (http public-IP HLS OK)"
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
            <div
              key={channel.index}
              className="grid gap-2 rounded border border-white/10 p-3 sm:grid-cols-[auto_1fr_1fr]"
            >
              <label className="flex items-start gap-2 pt-1 text-sm text-white">
                <input
                  type="checkbox"
                  checked={Boolean(selected[channel.index])}
                  onChange={(event) =>
                    setSelected((current) => ({
                      ...current,
                      [channel.index]: event.target.checked,
                    }))
                  }
                  className="mt-1"
                />
                <span>
                  {channel.title}
                  <span className="ml-2 text-xs text-gls-muted">{channel.group}</span>
                  {singleStream && (
                    <span className="mt-1 block text-xs text-gls-mint">
                      Single HLS — Staff picks recommended
                    </span>
                  )}
                </span>
              </label>
              <input
                value={targets[channel.index] || ""}
                onChange={(event) =>
                  setTargets((current) => ({
                    ...current,
                    [channel.index]: event.target.value,
                  }))
                }
                placeholder="catalog slug (optional — only for licensed publish)"
                className="gls-admin-input sm:col-span-2"
              />
            </div>
          ))}
        </div>
      )}
      {channels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || selectedCount === 0}
            onClick={() => void saveStaffPicks(true)}
            className="gls-cta rounded px-5 py-2.5 text-sm disabled:opacity-50"
          >
            Save as Staff picks
          </button>
          <button
            type="button"
            disabled={busy || selectedCount === 0}
            onClick={() => void saveStaffPicks(false)}
            className="rounded border border-white/20 px-4 py-2.5 text-sm text-white disabled:opacity-50"
          >
            Save Staff pick drafts
          </button>
          <button
            type="button"
            disabled={busy || !Object.values(targets).some((slug) => slug.trim())}
            onClick={() => void publishCatalog()}
            className="rounded border border-amber-400/40 px-4 py-2.5 text-sm text-amber-100 disabled:opacity-50"
            title="Licensed catalog only — requires catalog permission and MFA (AAL2)"
          >
            Publish mapped streams (catalog / MFA)
          </button>
        </div>
      )}
      <p aria-live="polite" className="text-sm text-gls-body">
        {status}
      </p>
    </section>
  );
}

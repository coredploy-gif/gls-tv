"use client";

import Link from "next/link";
import { ChannelNamePlate } from "@/components/ChannelNamePlate";
import {
  MEDIA_FORMAT_META,
  resolveMediaLinkThumbnail,
  type MediaLinkFormat,
} from "@/lib/media-links";

function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function checkedLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Checked recently";
  return `Checked ${new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date)}`;
}

export function MediaLinkCard({
  title,
  url,
  format,
  category,
  categoryOptions,
  thumbnailUrl,
  href,
  favorite,
  onFavorite,
  onRename,
  onMoveCategory,
  onRemove,
  onReport,
  onRecheck,
  busy,
  badge,
  status,
  lastCheckedAt,
  sourceLabel,
}: {
  title: string;
  url: string;
  format: MediaLinkFormat;
  category: string;
  categoryOptions?: string[];
  thumbnailUrl?: string | null;
  href: string;
  favorite?: boolean;
  onFavorite?: () => void;
  onRename?: () => void;
  onMoveCategory?: (next: string) => void;
  onRemove?: () => void;
  onReport?: () => void;
  onRecheck?: () => void;
  busy?: boolean;
  badge?: string;
  status?: "active" | "checking" | "dead" | "error";
  lastCheckedAt?: string | null;
  sourceLabel?: "Personal" | "GLS pick" | "Official";
}) {
  const meta = MEDIA_FORMAT_META[format];
  const poster = resolveMediaLinkThumbnail({
    title,
    category,
    format,
    thumbnailUrl,
  });
  const health = status
    ? {
        active: { label: "Live", className: "bg-emerald-500/90 text-white" },
        checking: { label: "Checking", className: "bg-sky-500/90 text-white" },
        dead: { label: "Offline", className: "bg-red-600/95 text-white" },
        error: { label: "Degraded", className: "bg-amber-500/95 text-black" },
      }[status]
    : null;
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div
        className="relative flex h-36 items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${meta.accent}22, transparent 55%), #0a0a0a`,
        }}
      >
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="text-sm font-semibold" style={{ color: meta.accent }}>
            {meta.label}
          </span>
        )}
        {badge ? (
          <span className="absolute left-2 top-2 z-[3] rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90">
            {badge}
          </span>
        ) : null}
        {health ? (
          <span className={`absolute right-2 top-2 z-[3] inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${health.className}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {health.label}
          </span>
        ) : null}
        <ChannelNamePlate title={title} compact />
        <Link
          href={href}
          aria-label={`Play ${title}`}
          className="absolute inset-0 z-[4] flex items-end justify-center bg-black/0 pb-3 opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100 focus-visible:bg-black/45 focus-visible:opacity-100"
        >
          <span className="rounded-full bg-gls-red px-4 py-2 text-sm font-semibold text-white shadow-lg">
            Play
          </span>
        </Link>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold text-white">{title}</h3>
          {onFavorite ? (
            <button
              type="button"
              onClick={onFavorite}
              className="shrink-0 text-gls-muted hover:text-gls-red"
              aria-label="Favorite"
            >
              {favorite ? "♥" : "♡"}
            </button>
          ) : null}
        </div>
        <p className="truncate text-xs text-gls-muted">{hostOf(url)}</p>
        <p className="text-[11px] text-white/50">
          {sourceLabel || "Personal"}
          {lastCheckedAt
            ? ` · ${checkedLabel(lastCheckedAt)}`
            : " · Not checked recently"}
        </p>
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <span
            className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ borderColor: `${meta.accent}66`, color: meta.accent }}
          >
            {meta.label}
          </span>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-gls-muted">
            {category}
          </span>
        </div>
        {onMoveCategory && categoryOptions ? (
          <label className="block pt-1">
            <span className="sr-only">Move to folder</span>
            <select
              value={category}
              disabled={busy}
              onChange={(e) => onMoveCategory(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white outline-none focus:border-gls-red"
            >
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex gap-2 pt-1">
          <Link
            href={href}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white hover:border-white/40"
          >
            Open
          </Link>
          {onRename ? (
            <button
              type="button"
              disabled={busy}
              onClick={onRename}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gls-muted hover:text-white"
            >
              Rename
            </button>
          ) : null}
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-lg border border-gls-red/30 px-3 py-1.5 text-xs text-red-300"
            >
              Remove
            </button>
          ) : null}
          {onReport ? (
            <button
              type="button"
              onClick={onReport}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gls-muted hover:text-white"
            >
              Report
            </button>
          ) : null}
          {onRecheck ? (
            <button
              type="button"
              disabled={busy}
              onClick={onRecheck}
              className="rounded-lg border border-emerald-400/25 px-3 py-1.5 text-xs text-emerald-200 hover:border-emerald-300 disabled:opacity-45"
            >
              {busy ? "Checking…" : "Recheck"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

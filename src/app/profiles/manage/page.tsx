"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { GlsLogo } from "@/components/GlsLogo";
import { useAuth } from "@/lib/auth/AuthProvider";

type Viewer = {
  id: string;
  name: string;
  avatar_id: string;
  avatar_url?: string | null;
  is_kids: boolean;
};

type Avatar = {
  id: string;
  title: string;
  url: string;
  thumb_url?: string | null;
  is_kids: boolean;
  category?: string | null;
};

export default function ManageProfilesPage() {
  const { user, loading } = useAuth();
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [plan, setPlan] = useState("trial");
  const [adultLimit, setAdultLimit] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Viewer | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [avatarId, setAvatarId] = useState("avatar-01");
  const [avatarCategory, setAvatarCategory] = useState<string>("all");
  const [asKids, setAsKids] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/membership/profiles");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to load");
    setViewers(json.viewers || []);
    setAvatars(json.avatars || []);
    setPlan(json.plan || "trial");
    setAdultLimit(json.adultLimit || 2);
  }, []);

  useEffect(() => {
    if (!user) return;
    queueMicrotask(() => {
      void load().catch((e) => setError(e.message));
    });
  }, [user, load]);

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setName("");
    setAsKids(false);
    setAvatarId("avatar-01");
    setError(null);
  };

  const openEdit = (v: Viewer) => {
    setEditing(v);
    setCreating(false);
    setName(v.name);
    setAvatarId(v.avatar_id);
    setAsKids(v.is_kids);
    setError(null);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/membership/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          creating
            ? {
                action: "create",
                name,
                avatar_id: avatarId,
                is_kids: asKids,
              }
            : {
                action: "update",
                viewerId: editing?.id,
                name,
                avatar_id: avatarId,
              },
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setViewers(json.viewers || []);
      setCreating(false);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (v: Viewer) => {
    if (!confirm(`Remove profile “${v.name}”?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/membership/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", viewerId: v.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Delete failed");
      setViewers(json.viewers || []);
      if (editing?.id === v.id) setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gls-black">
        <div className="gls-buffer-ring" />
      </main>
    );
  }

  const adults = viewers.filter((v) => !v.is_kids).length;
  const hasKids = viewers.some((v) => v.is_kids);
  const canAddAdult = adults < adultLimit;
  const canAddKids = !hasKids;
  const formOpen = creating || Boolean(editing);

  return (
    <main className="min-h-screen bg-gls-black px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <GlsLogo size="md" href="/profiles" />
        <h1 className="gls-display mt-10 text-4xl">Manage Profiles</h1>
        <p className="mt-2 text-sm text-gls-muted">
          Plan: {plan} · {adults}/{adultLimit} adult profiles
          {hasKids ? " · Kids on" : ""}
        </p>

        {error && <p className="mt-4 text-sm text-gls-red">{error}</p>}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {viewers.map((v) => (
            <div
              key={v.id}
              className="flex items-center gap-4 rounded-sm border border-white/10 bg-gls-elevated/50 p-4"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  v.avatar_url ||
                  `https://api.dicebear.com/9.x/shapes/svg?seed=${v.id}`
                }
                alt=""
                className="gls-avatar-ring h-16 w-16 shrink-0 rounded-md object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{v.name}</p>
                <p className="text-xs text-gls-muted">
                  {v.is_kids ? "Kids" : "Adult"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(v)}
                    className="rounded border border-white/20 px-2.5 py-1 text-xs hover:border-white"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(v)}
                    disabled={busy || viewers.length <= 1}
                    className="rounded border border-white/10 px-2.5 py-1 text-xs text-gls-muted hover:border-gls-red hover:text-white disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={openCreate}
            disabled={!canAddAdult && !canAddKids}
            className="gls-cta rounded px-4 py-2 text-sm disabled:opacity-40"
          >
            + Add profile
          </button>
          {!canAddAdult && (
            <Link href="/pricing" className="text-sm text-gls-muted hover:text-white">
              Upgrade for more adult slots
            </Link>
          )}
        </div>

        {formOpen && (
          <div className="mt-8 rounded-sm border border-white/15 bg-gls-elevated/80 p-5">
            <h2 className="text-lg font-semibold">
              {creating ? "Add profile" : `Edit ${editing?.name}`}
            </h2>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-wider text-gls-muted">
                Name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                className="mt-1.5 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-gls-red"
                placeholder="Profile name"
              />
            </label>

            {creating && canAddKids && (
              <label className="mt-3 flex items-center gap-2 text-sm text-gls-body">
                <input
                  type="checkbox"
                  checked={asKids}
                  onChange={(e) => {
                    setAsKids(e.target.checked);
                    setAvatarId(
                      e.target.checked ? "avatar-kids-01" : "avatar-01",
                    );
                  }}
                  disabled={!canAddAdult && canAddKids}
                />
                Kids profile
              </label>
            )}

            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-gls-muted">
              Avatar
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {["all", "cartoon", "animals", "nature", "buildings", "people"].map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setAvatarCategory(cat)}
                    className={`rounded px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      avatarCategory === cat
                        ? "bg-white text-black"
                        : "bg-white/10 text-gls-muted hover:text-white"
                    }`}
                  >
                    {cat}
                  </button>
                ),
              )}
            </div>
            <div className="mt-2 grid max-h-64 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5">
              {avatars
                .filter((a) =>
                  avatarCategory === "all"
                    ? true
                    : (a.category || "people") === avatarCategory,
                )
                .map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAvatarId(a.id)}
                  className={`overflow-hidden rounded-md border-2 ${
                    avatarId === a.id
                      ? "border-gls-red"
                      : "border-transparent hover:border-white/40"
                  }`}
                  title={a.title}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.thumb_url || a.url}
                    alt={a.title}
                    className="aspect-square w-full object-cover"
                  />
                </button>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy || !name.trim()}
                onClick={save}
                className="gls-cta rounded px-4 py-2 text-sm disabled:opacity-40"
              >
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                }}
                className="rounded border border-white/20 px-4 py-2 text-sm text-gls-muted hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <Link
          href="/profiles"
          className="gls-cta mt-10 inline-flex rounded px-5 py-2 text-sm"
        >
          Done
        </Link>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";

type DeviceSession = {
  id: string;
  label: string;
  audience: "adult" | "kids";
  viewerName: string | null;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
  active: boolean;
};

type AccountData = {
  account: {
    email: string;
    createdAt: string;
    profile?: { display_name?: string; member_reference?: string; plan?: string };
  };
  preferences: {
    sports: boolean;
    activity: boolean;
    product: boolean;
    email_nonessential: boolean;
  };
  deletion?: { status: string; execute_after: string } | null;
  sessions: {
    deviceListAvailable: boolean;
    note: string;
    adultLimit?: number;
    kidsLimit?: number;
    devices?: DeviceSession[];
  };
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function AccountDashboard() {
  const [data, setData] = useState<AccountData | null>(null);
  const [status, setStatus] = useState("Loading account…");
  const [busy, setBusy] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const load = async () => {
    const res = await fetch("/api/account", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Account could not be loaded");
    setData(json);
    setDisplayName(json.account.profile?.display_name || "");
    setStatus("");
  };

  useEffect(() => {
    queueMicrotask(() => {
      void load().catch((error: Error) => setStatus(error.message));
    });
  }, []);

  const send = async (method: "PATCH" | "POST", body: Record<string, unknown>) => {
    setBusy(true);
    setStatus("Saving…");
    const res = await fetch("/api/account", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setStatus(json.error || "Request failed");
      return false;
    }
    setStatus(
      json.confirmationRequired
        ? "Check both email addresses to confirm the change."
        : "Saved.",
    );
    await load();
    return true;
  };

  if (!data) {
    return (
      <p role="status" aria-live="polite" className="text-gls-muted">
        {status}
      </p>
    );
  }

  const devices = data.sessions.devices || [];
  const adultActive = devices.filter((d) => d.audience === "adult" && d.active).length;
  const kidsActive = devices.filter((d) => d.audience === "kids" && d.active).length;

  return (
    <div className="space-y-6">
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-gls-pink-soft">
        {status}
      </p>

      <section className="gls-glass rounded-xl p-5" aria-labelledby="account-details">
        <h2 id="account-details" className="text-xl font-semibold text-white">
          Account details
        </h2>
        <p className="mt-2 text-sm text-gls-body">{data.account.email}</p>
        <p className="text-xs text-gls-muted">
          Member {data.account.profile?.member_reference || "pending"} ·{" "}
          {data.account.profile?.plan || "trial"}
        </p>
        <label className="mt-4 block text-sm text-gls-body">
          Display name
          <input
            className="gls-admin-input mt-1"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <button
          disabled={busy}
          className="gls-cta mt-3 rounded px-4 py-2 text-sm"
          onClick={() => void send("PATCH", { action: "profile", displayName })}
        >
          Save name
        </button>
      </section>

      <section
        id="devices"
        className="gls-glass scroll-mt-24 rounded-xl p-5"
        aria-labelledby="devices-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="devices-heading" className="text-xl font-semibold text-white">
              Devices &amp; streams
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-gls-muted">
              {data.sessions.note}
            </p>
          </div>
          <p className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-gls-body">
            Adults {adultActive}/{data.sessions.adultLimit ?? 2} · Kids {kidsActive}/
            {data.sessions.kidsLimit ?? 1}
          </p>
        </div>

        {devices.length === 0 ? (
          <p className="mt-5 text-sm text-gls-muted">
            No active devices yet. Choose a profile to start watching.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-white/10">
            {devices.map((device) => (
              <li
                key={device.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-white">{device.label}</p>
                    {device.isCurrent && (
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
                        This device
                      </span>
                    )}
                    {!device.active && (
                      <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gls-muted">
                        Idle
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gls-body">
                    {device.audience === "kids" ? "Kids" : "Adult"} stream
                    {device.viewerName ? ` · ${device.viewerName}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-gls-muted">
                    Last active {formatWhen(device.lastActiveAt)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  className="shrink-0 rounded-md border border-white/20 px-4 py-2 text-sm text-white transition hover:border-gls-pink/50 hover:bg-white/5 disabled:opacity-50"
                  onClick={() =>
                    void send("POST", {
                      action: "revoke_device",
                      sessionId: device.id,
                    }).then((ok) => {
                      if (ok && device.isCurrent) {
                        window.location.assign("/profiles");
                      }
                    })
                  }
                >
                  Sign out
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
          <button
            disabled={busy}
            className="rounded border border-red-400/40 px-4 py-2 text-sm text-red-200"
            onClick={() =>
              void send("POST", { action: "revoke_all" }).then((ok) => {
                if (ok) window.location.assign("/auth");
              })
            }
          >
            Sign out all devices
          </button>
          <a
            href="/profiles"
            className="rounded border border-white/20 px-4 py-2 text-sm text-white"
          >
            Choose profile
          </a>
        </div>
      </section>

      <section className="gls-glass rounded-xl p-5" aria-labelledby="security-settings">
        <h2 id="security-settings" className="text-xl font-semibold text-white">
          Security
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="relative block">
            <input
              type={showPasswords ? "text" : "password"}
              autoComplete="current-password"
              className="gls-admin-input w-full pr-16"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label className="relative block">
            <input
              type={showPasswords ? "text" : "password"}
              autoComplete="new-password"
              className="gls-admin-input w-full pr-16"
              placeholder="New password (8+ characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="mt-2 text-xs text-gls-muted underline hover:text-white"
          onClick={() => setShowPasswords((v) => !v)}
        >
          {showPasswords ? "Hide passwords" : "Show passwords"}
        </button>
        <button
          disabled={busy}
          className="mt-3 rounded border border-white/20 px-4 py-2 text-sm text-white"
          onClick={() =>
            void send("PATCH", {
              action: "password",
              currentPassword,
              password: newPassword,
            })
          }
        >
          Change password
        </button>
        <div className="mt-5 flex flex-col gap-3 md:flex-row">
          <input
            type="email"
            className="gls-admin-input"
            placeholder="New email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <button
            disabled={busy}
            className="rounded border border-white/20 px-4 py-2 text-sm text-white"
            onClick={() =>
              void send("PATCH", {
                action: "email",
                email: newEmail,
                currentPassword,
              })
            }
          >
            Request email change
          </button>
        </div>
      </section>

      <section className="gls-glass rounded-xl p-5" aria-labelledby="notifications-settings">
        <h2 id="notifications-settings" className="text-xl font-semibold text-white">
          Notification preferences
        </h2>
        <p className="mt-1 text-xs text-gls-muted">
          Security, payment and service notices always remain enabled.
        </p>
        {(["sports", "activity", "product"] as const).map((key) => (
          <label key={key} className="mt-3 flex items-center gap-2 text-sm text-gls-body">
            <input
              type="checkbox"
              checked={data.preferences[key]}
              onChange={(e) =>
                setData({
                  ...data,
                  preferences: { ...data.preferences, [key]: e.target.checked },
                })
              }
            />
            {key[0].toUpperCase() + key.slice(1)} notices
          </label>
        ))}
        <button
          disabled={busy}
          className="mt-4 rounded border border-white/20 px-4 py-2 text-sm text-white"
          onClick={() =>
            void send("PATCH", {
              action: "preferences",
              sports: data.preferences.sports,
              activity: data.preferences.activity,
              product: data.preferences.product,
              emailNonessential: false,
            })
          }
        >
          Save preferences
        </button>
      </section>

      <section className="gls-glass rounded-xl p-5">
        <h2 className="text-xl font-semibold text-white">Your data</h2>
        <a
          className="mt-3 inline-block rounded border border-white/20 px-4 py-2 text-sm text-white"
          href="/api/account/export"
        >
          Download JSON export
        </a>
      </section>

      <section
        className="rounded-xl border border-red-500/30 bg-red-950/20 p-5"
        aria-labelledby="delete-account"
      >
        <h2 id="delete-account" className="text-xl font-semibold text-red-100">
          Delete account
        </h2>
        {data.deletion?.status === "cooling_off" ? (
          <>
            <p className="mt-2 text-sm text-red-200">
              Scheduled after {new Date(data.deletion.execute_after).toLocaleString()}.
            </p>
            <button
              disabled={busy}
              className="mt-3 rounded bg-white px-4 py-2 text-sm text-black"
              onClick={() => void send("POST", { action: "cancel_deletion" })}
            >
              Cancel deletion
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-red-200">
              A 7-day cooling-off period applies. Enter your current password and the exact
              phrase DELETE MY ACCOUNT.
            </p>
            <input
              className="gls-admin-input mt-3"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
            />
            <button
              disabled={busy || confirmation !== "DELETE MY ACCOUNT"}
              className="mt-3 rounded bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              onClick={() =>
                void send("POST", {
                  action: "request_deletion",
                  confirmation,
                  currentPassword,
                })
              }
            >
              Schedule deletion
            </button>
          </>
        )}
      </section>
    </div>
  );
}

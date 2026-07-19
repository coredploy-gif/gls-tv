"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type AdminUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  plan: string;
  is_premium: boolean;
  trial_ends_at: string | null;
  is_admin_exception: boolean;
  trial_bypassed: boolean;
  account_status: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  max_viewer_profiles: number;
  created_at: string | null;
  member_reference: string | null;
};

type StatusFilter = "all" | "active" | "disabled" | "exception";

type ModalMode = "email" | "password" | null;

type PageSize = 20 | 30 | 40 | 50;

const PAGE_SIZE_OPTIONS: PageSize[] = [20, 30, 40, 50];

function statusLabel(status: string | null | undefined) {
  const value = status || "active";
  if (value === "active") return "Active";
  if (value === "suspended") return "Disabled";
  if (value === "deletion_pending") return "Delete pending";
  if (value === "anonymized") return "Anonymized";
  return value;
}

function statusTone(status: string | null | undefined) {
  const value = status || "active";
  if (value === "active") return "bg-emerald-500/15 text-emerald-300";
  if (value === "suspended") return "bg-amber-500/15 text-amber-200";
  if (value === "deletion_pending") return "bg-gls-red/15 text-red-200";
  return "bg-white/10 text-gls-body";
}

function UserConfigMenu({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    placeAbove: boolean;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }

    const updatePlacement = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuWidth = 184;
      const menuHeight = menuRef.current?.offsetHeight || 280;
      const placeAbove =
        rect.bottom + menuHeight > window.innerHeight &&
        rect.top > menuHeight + 8;
      const top = placeAbove ? rect.top - 4 : rect.bottom + 4;
      const left = Math.min(
        Math.max(8, rect.right - menuWidth),
        window.innerWidth - menuWidth - 8,
      );
      setCoords({ top, left, placeAbove });
    };

    updatePlacement();
    // Re-measure after paint once menu has height.
    const raf = requestAnimationFrame(updatePlacement);

    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        onOpenChange(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-md border border-white/15 px-2.5 py-1 text-[11px] text-gls-body hover:text-white"
        onClick={() => {
          if (!open) {
            const rect = rootRef.current?.getBoundingClientRect();
            if (rect) {
              const menuWidth = 184;
              setCoords({
                top: rect.bottom + 4,
                left: Math.min(
                  Math.max(8, rect.right - menuWidth),
                  window.innerWidth - menuWidth - 8,
                ),
                placeAbove: false,
              });
            }
          }
          onOpenChange(!open);
        }}
      >
        Config
      </button>
      {open && coords && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[60] min-w-[11.5rem] rounded-lg border border-white/15 bg-[#12151c] py-1 shadow-xl shadow-black/50"
          style={{
            top: coords.top,
            left: coords.left,
            transform: coords.placeAbove ? "translateY(-100%)" : undefined,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children,
  disabled,
  danger,
  title,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      title={title}
      className={`block w-full px-3 py-2 text-left text-[12px] disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? "text-red-200 hover:bg-gls-red/15"
          : "text-gls-body hover:bg-white/5 hover:text-white"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function AdminUsersHub() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [params, setParams] = useState<{
    q: string;
    status: StatusFilter;
    page: number;
    pageSize: PageSize;
  }>({ q: "", status: "all", page: 1, pageSize: 20 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuUserId, setMenuUserId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [canOwnerActions, setCanOwnerActions] = useState(false);
  const [grantEmail, setGrantEmail] = useState("");

  const [modal, setModal] = useState<ModalMode>(null);
  const [modalUser, setModalUser] = useState<AdminUser | null>(null);
  const [modalEmail, setModalEmail] = useState("");
  const [modalPassword, setModalPassword] = useState("");
  const [modalPassword2, setModalPassword2] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      const next = q.trim();
      setParams((prev) => {
        if (prev.q === next) return prev;
        return { ...prev, q: next, page: 1 };
      });
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // Clear page-local selection when filters change (not on page-only navigation).
  const filterKey = `${params.q}|${params.status}|${params.pageSize}`;
  const prevFilterKey = useRef(filterKey);
  useEffect(() => {
    if (prevFilterKey.current === filterKey) return;
    prevFilterKey.current = filterKey;
    setSelected(new Set());
    setMenuUserId(null);
  }, [filterKey]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/admin/users?q=${encodeURIComponent(params.q)}&status=${params.status}&page=${params.page}&pageSize=${params.pageSize}`,
      { cache: "no-store" },
    );
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setOk(false);
      setMsg(json.error || "Failed to load users");
      return;
    }
    setUsers(json.users || []);
    setTotal(Number(json.total) || 0);
    if (json.page && json.page !== params.page) {
      setParams((prev) =>
        prev.page === json.page ? prev : { ...prev, page: json.page },
      );
    }
    setNeedsMfa(Boolean(json.needsMfa));
    setCanOwnerActions(Boolean(json.canOwnerActions));
    // Selection is page-local: keep only ids still visible on this page.
    setSelected((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if ((json.users || []).some((u: AdminUser) => u.id === id)) {
          next.add(id);
        }
      }
      return next;
    });
    setMenuUserId(null);
  }, [params]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const allSelected = useMemo(
    () => users.length > 0 && users.every((u) => selected.has(u.id)),
    [users, selected],
  );

  const selectedIds = useMemo(() => [...selected], [selected]);

  const pageCount = Math.max(1, Math.ceil(total / params.pageSize) || 1);
  const rangeStart =
    total === 0 ? 0 : (params.page - 1) * params.pageSize + 1;
  const rangeEnd = Math.min(params.page * params.pageSize, total);

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(users.map((u) => u.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runAction = async (
    action: string,
    body: Record<string, unknown> = {},
    confirmText?: string,
  ) => {
    if (confirmText && !confirm(confirmText)) return false;
    setBusy(true);
    setMsg(null);
    setOk(false);
    setMenuUserId(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const json = await res.json();
    setBusy(false);
    setOk(res.ok);
    setMsg(
      res.ok
        ? json.count != null
          ? `Done (${json.count})`
          : "Done"
        : json.error || "Action failed",
    );
    if (res.ok) {
      setSelected(new Set());
      void load();
    }
    return res.ok;
  };

  const openEmailModal = (user: AdminUser) => {
    setMenuUserId(null);
    setModalUser(user);
    setModalEmail(user.email || "");
    setModalPassword("");
    setModalPassword2("");
    setModal("email");
  };

  const openPasswordModal = (user: AdminUser) => {
    setMenuUserId(null);
    setModalUser(user);
    setModalEmail("");
    setModalPassword("");
    setModalPassword2("");
    setModal("password");
  };

  const submitModal = async () => {
    if (!modalUser || !modal) return;
    if (modal === "email") {
      if (!modalEmail.includes("@")) {
        setOk(false);
        setMsg("Enter a valid email");
        return;
      }
      if (
        !confirm(
          `Change login email for ${modalUser.email || modalUser.id} to ${modalEmail}?`,
        )
      ) {
        return;
      }
      const success = await runAction("update_email", {
        userId: modalUser.id,
        email: modalEmail,
      });
      if (success) setModal(null);
      return;
    }

    if (modalPassword.length < 8) {
      setOk(false);
      setMsg("Password must be at least 8 characters");
      return;
    }
    if (modalPassword !== modalPassword2) {
      setOk(false);
      setMsg("Passwords do not match");
      return;
    }
    if (
      !confirm(
        `Set a new password for ${modalUser.email || modalUser.id}? They can sign in immediately with it.`,
      )
    ) {
      return;
    }
    const success = await runAction("set_password", {
      userId: modalUser.id,
      password: modalPassword,
    });
    if (success) {
      setModal(null);
      setModalPassword("");
      setModalPassword2("");
    }
  };

  const goPrev = () => {
    setSelected(new Set());
    setMenuUserId(null);
    setParams((prev) => ({
      ...prev,
      page: Math.max(1, prev.page - 1),
    }));
  };

  const goNext = () => {
    setSelected(new Set());
    setMenuUserId(null);
    setParams((prev) => ({
      ...prev,
      page: Math.min(pageCount, prev.page + 1),
    }));
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Membership"
        title="Users"
        description="Search members, grant access exceptions, remind, reset credentials, and enable or disable accounts."
        actions={
          <>
            <Link
              href="/admin/finance/membership"
              className="shrink-0 rounded-md border border-white/15 px-3 py-2 text-xs font-bold uppercase tracking-wide text-gls-muted hover:text-white"
            >
              Funnel
            </Link>
            <Link
              href="/admin/finance/customers"
              className="shrink-0 rounded-md border border-white/15 px-3 py-2 text-xs font-bold uppercase tracking-wide text-gls-muted hover:text-white"
            >
              Finance customers
            </Link>
            <Link
              href="/admin/access"
              className="shrink-0 rounded-md border border-white/15 px-3 py-2 text-xs font-bold uppercase tracking-wide text-gls-muted hover:text-white"
            >
              Roles
            </Link>
          </>
        }
      />

      {needsMfa && (
        <p
          role="status"
          className="mt-4 rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
        >
          Verify MFA (AAL2) to change emails, set passwords, or enable/disable
          accounts. Exception grants and reminders still work.
        </p>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
        <aside className="gls-admin-card relative h-fit overflow-hidden rounded-xl p-5">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gls-red/15 blur-3xl" />
          <p className="relative text-[10px] font-bold uppercase tracking-[0.28em] text-gls-red">
            Grant exception
          </p>
          <p className="relative mt-2 text-sm text-gls-muted">
            Access override: marks the account premium with{" "}
            <span className="text-white/80">plan = exception</span>, trial
            bypass, and device/trial lock override. Use for support comps or
            device-trial blocks.
          </p>
          <label className="relative mt-5 block text-xs font-medium text-gls-muted">
            User email
            <input
              value={grantEmail}
              onChange={(e) => setGrantEmail(e.target.value)}
              className="gls-admin-input mt-1.5"
              placeholder="member@email.com"
            />
          </label>
          <button
            type="button"
            disabled={busy || !grantEmail.includes("@")}
            onClick={() =>
              void runAction("grant_exception", { email: grantEmail }).then(
                (success) => {
                  if (success) setGrantEmail("");
                },
              )
            }
            className="gls-cta relative mt-4 w-full rounded-md px-4 py-2.5 text-sm disabled:opacity-40"
          >
            {busy ? "Granting…" : "Grant exception"}
          </button>
          {msg && (
            <p
              className={`relative mt-4 rounded-md px-3 py-2 text-sm ${
                ok
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "bg-gls-red/10 text-red-300"
              }`}
            >
              {msg}
            </p>
          )}
        </aside>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="gls-admin-input max-w-md flex-1"
              placeholder="Search email, name, member ref…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="gls-admin-input max-w-[11rem]"
              value={params.status}
              onChange={(e) => {
                const next = e.target.value as StatusFilter;
                setSelected(new Set());
                setMenuUserId(null);
                setParams((prev) => ({
                  ...prev,
                  status: next,
                  page: 1,
                }));
              }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled / pending</option>
              <option value="exception">Exceptions</option>
            </select>
            <label className="flex items-center gap-1.5 text-[11px] text-gls-muted">
              <span className="sr-only">Rows per page</span>
              <select
                className="gls-admin-input max-w-[5.5rem]"
                value={params.pageSize}
                onChange={(e) => {
                  const next = Number(e.target.value) as PageSize;
                  setSelected(new Set());
                  setMenuUserId(null);
                  setParams((prev) => ({
                    ...prev,
                    pageSize: next,
                    page: 1,
                  }));
                }}
                aria-label="Rows per page"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-md border border-white/15 px-3 py-2 text-xs text-gls-body hover:text-white"
            >
              Refresh
            </button>
          </div>

          {selectedIds.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-gls-pink/30 bg-gls-pink/10 px-3 py-2.5">
              <span className="text-xs font-semibold text-white">
                {selectedIds.length} selected
              </span>
              <button
                type="button"
                disabled={busy}
                className="rounded-md border border-white/20 px-2.5 py-1 text-[11px] text-gls-body hover:text-white disabled:opacity-40"
                onClick={() =>
                  void runAction("grant_exception", { userIds: selectedIds })
                }
              >
                Grant exception
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-md border border-white/20 px-2.5 py-1 text-[11px] text-gls-body hover:text-white disabled:opacity-40"
                onClick={() =>
                  void runAction("remind", { userIds: selectedIds })
                }
              >
                Remind
              </button>
              <button
                type="button"
                disabled={busy || !canOwnerActions}
                title={
                  !canOwnerActions ? "Owner + MFA required" : undefined
                }
                className="rounded-md border border-white/20 px-2.5 py-1 text-[11px] text-gls-body hover:text-white disabled:opacity-40"
                onClick={() =>
                  void runAction(
                    "enable",
                    { userIds: selectedIds },
                    `Enable ${selectedIds.length} account(s)?`,
                  )
                }
              >
                Enable
              </button>
              <button
                type="button"
                disabled={busy || !canOwnerActions}
                title={
                  !canOwnerActions ? "Owner + MFA required" : undefined
                }
                className="rounded-md border border-amber-400/40 px-2.5 py-1 text-[11px] text-amber-100 hover:bg-amber-500/10 disabled:opacity-40"
                onClick={() =>
                  void runAction(
                    "disable",
                    { userIds: selectedIds },
                    `Disable ${selectedIds.length} account(s)? They will be banned from signing in.`,
                  )
                }
              >
                Disable
              </button>
              <button
                type="button"
                disabled={busy || !canOwnerActions}
                title={
                  !canOwnerActions ? "Owner + MFA required" : undefined
                }
                className="rounded-md border border-gls-red/40 px-2.5 py-1 text-[11px] text-red-200 hover:bg-gls-red/10 disabled:opacity-40"
                onClick={() =>
                  void runAction(
                    "delete",
                    { userIds: selectedIds },
                    `Mark ${selectedIds.length} account(s) for deletion? This suspends login (soft delete). Hard anonymize still runs via maintenance.`,
                  )
                }
              >
                Delete
              </button>
              <button
                type="button"
                className="ml-auto text-[11px] text-gls-muted underline hover:text-white"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </button>
            </div>
          )}

          <div className="gls-h-scroll mt-4 rounded-xl border border-white/10">
            <table className="min-w-[720px] w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-[0.18em] text-gls-muted">
                <tr>
                  <th className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all users on this page"
                    />
                  </th>
                  <th className="px-3 py-3 font-semibold">Member</th>
                  <th className="px-3 py-3 font-semibold">Plan</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isException =
                    u.is_admin_exception ||
                    u.trial_bypassed ||
                    u.plan === "exception";
                  const isActive = (u.account_status || "active") === "active";
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-white/5 align-middle hover:bg-white/[0.02]"
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(u.id)}
                          onChange={() => toggleOne(u.id)}
                          aria-label={`Select ${u.email || u.id}`}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-white">
                          {u.email || u.display_name || u.id.slice(0, 8)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-gls-muted">
                          {u.display_name && u.email
                            ? `${u.display_name} · `
                            : ""}
                          {u.member_reference || u.id.slice(0, 8)}
                          {u.created_at
                            ? ` · joined ${new Date(u.created_at).toLocaleDateString()}`
                            : ""}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <span className="gls-admin-pill bg-gls-pink/15 text-gls-pink">
                            {u.plan}
                          </span>
                          {u.is_premium && (
                            <span className="gls-admin-pill bg-emerald-500/15 text-emerald-300">
                              premium
                            </span>
                          )}
                          {isException && (
                            <span className="gls-admin-pill bg-sky-500/15 text-sky-200">
                              exception
                            </span>
                          )}
                        </div>
                        {u.trial_ends_at && (
                          <p className="mt-1 text-[11px] text-gls-muted">
                            Trial{" "}
                            {new Date(u.trial_ends_at).toLocaleDateString()}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`gls-admin-pill ${statusTone(u.account_status)}`}
                        >
                          {statusLabel(u.account_status)}
                        </span>
                        {u.suspended_reason && (
                          <p className="mt-1 max-w-[12rem] truncate text-[11px] text-gls-muted">
                            {u.suspended_reason}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <UserConfigMenu
                          open={menuUserId === u.id}
                          onOpenChange={(next) =>
                            setMenuUserId(next ? u.id : null)
                          }
                        >
                          <MenuItem
                            disabled={busy}
                            onClick={() =>
                              void runAction("remind", { userIds: [u.id] })
                            }
                          >
                            Remind
                          </MenuItem>
                          <MenuItem
                            disabled={busy || isException}
                            onClick={() =>
                              void runAction("grant_exception", {
                                userIds: [u.id],
                              })
                            }
                          >
                            Grant exception
                          </MenuItem>
                          <MenuItem
                            disabled={busy}
                            onClick={() => openEmailModal(u)}
                          >
                            Edit email
                          </MenuItem>
                          <MenuItem
                            disabled={busy}
                            onClick={() => openPasswordModal(u)}
                          >
                            Password
                          </MenuItem>
                          {isActive ? (
                            <MenuItem
                              disabled={busy || !canOwnerActions}
                              title={
                                !canOwnerActions
                                  ? "Owner + MFA required"
                                  : undefined
                              }
                              onClick={() =>
                                void runAction(
                                  "disable",
                                  { userIds: [u.id] },
                                  `Disable ${u.email || u.id}?`,
                                )
                              }
                            >
                              Disable
                            </MenuItem>
                          ) : (
                            <MenuItem
                              disabled={busy || !canOwnerActions}
                              title={
                                !canOwnerActions
                                  ? "Owner + MFA required"
                                  : undefined
                              }
                              onClick={() =>
                                void runAction(
                                  "enable",
                                  { userIds: [u.id] },
                                  `Enable ${u.email || u.id}?`,
                                )
                              }
                            >
                              Enable
                            </MenuItem>
                          )}
                          <MenuItem
                            danger
                            disabled={busy || !canOwnerActions}
                            title={
                              !canOwnerActions
                                ? "Owner + MFA required"
                                : undefined
                            }
                            onClick={() =>
                              void runAction(
                                "delete",
                                { userIds: [u.id] },
                                `Mark ${u.email || u.id} for deletion? This suspends login (soft delete).`,
                              )
                            }
                          >
                            Delete
                          </MenuItem>
                        </UserConfigMenu>
                      </td>
                    </tr>
                  );
                })}
                {!loading && !users.length && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-12 text-center text-sm text-gls-muted"
                    >
                      No profiles matched
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-3 py-12 text-center">
                      <div className="mx-auto gls-buffer-ring" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gls-muted">
            <p>
              {total === 0
                ? "No users"
                : `Page ${params.page} · ${rangeStart}–${rangeEnd} of ${total}`}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy || loading || params.page <= 1}
                onClick={goPrev}
                className="rounded-md border border-white/15 px-3 py-1.5 text-gls-body hover:text-white disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={busy || loading || params.page >= pageCount}
                onClick={goNext}
                className="rounded-md border border-white/15 px-3 py-1.5 text-gls-body hover:text-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {modal && modalUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="users-modal-title"
          onClick={() => setModal(null)}
        >
          <div
            className="gls-admin-card w-full max-w-md rounded-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="users-modal-title"
              className="text-lg font-semibold text-white"
            >
              {modal === "email" ? "Edit email" : "Set password"}
            </h3>
            <p className="mt-1 text-sm text-gls-muted">
              {modalUser.email || modalUser.id}
              {modal === "email"
                ? " — use for support ticket email changes. Updates Auth + profile."
                : " — admin override password. Min 8 characters."}
            </p>
            {modal === "email" ? (
              <label className="mt-4 block text-xs text-gls-muted">
                New email
                <input
                  className="gls-admin-input mt-1.5"
                  type="email"
                  value={modalEmail}
                  onChange={(e) => setModalEmail(e.target.value)}
                  autoComplete="off"
                />
              </label>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block text-xs text-gls-muted">
                  New password
                  <input
                    className="gls-admin-input mt-1.5"
                    type="password"
                    value={modalPassword}
                    onChange={(e) => setModalPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                  />
                </label>
                <label className="block text-xs text-gls-muted">
                  Confirm password
                  <input
                    className="gls-admin-input mt-1.5"
                    type="password"
                    value={modalPassword2}
                    onChange={(e) => setModalPassword2(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                  />
                </label>
              </div>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-white/15 px-3 py-2 text-xs text-gls-body hover:text-white"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                className="gls-cta rounded-md px-4 py-2 text-sm disabled:opacity-40"
                onClick={() => void submitModal()}
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

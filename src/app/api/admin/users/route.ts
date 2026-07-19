import { NextRequest, NextResponse } from "next/server";
import {
  getAdminAccess,
  hasAdminPermission,
  requireAal2,
  type AdminAccess,
} from "@/lib/admin/access";
import { writeAuditLog } from "@/lib/admin/audit";
import { createServiceClient } from "@/lib/eadmin";
import { maxViewerSlots } from "@/lib/membership/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Service = NonNullable<ReturnType<typeof createServiceClient>>;

function canReadUsers(access: AdminAccess) {
  return (
    hasAdminPermission(access, "support.write") ||
    hasAdminPermission(access, "finance.read") ||
    hasAdminPermission(access, "finance.write")
  );
}

function canManageUsers(access: AdminAccess) {
  return (
    hasAdminPermission(access, "support.write") ||
    hasAdminPermission(access, "finance.write")
  );
}

function requireOwnerMfa(access: AdminAccess) {
  return access.roles.includes("owner") && requireAal2(access);
}

function parseIds(body: Record<string, unknown>): string[] {
  const raw = body.userIds ?? body.userId;
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((id) => String(id || "").trim()).filter(Boolean))];
  }
  const one = String(raw || "").trim();
  return one ? [one] : [];
}

async function setAccountStatus(
  service: Service,
  userIds: string[],
  status: "active" | "suspended" | "deletion_pending",
  reason: string | null,
) {
  const now = new Date().toISOString();
  const suspended = status !== "active";
  await service
    .from("profiles")
    .update({
      account_status: status,
      suspended_at: suspended ? now : null,
      suspended_reason: suspended
        ? reason ||
          (status === "deletion_pending"
            ? "Queued for deletion by admin"
            : "Administrative suspension")
        : null,
    })
    .in("id", userIds);

  for (const userId of userIds) {
    await service.auth.admin.updateUserById(userId, {
      ban_duration: suspended ? "876000h" : "none",
    });
  }
}

const PAGE_SIZES = new Set([20, 30, 40, 50]);

function sanitizeSearchTerm(raw: string) {
  return raw
    .trim()
    .replace(/[%_]/g, "")
    .replace(/[,.()]/g, " ")
    .trim()
    .slice(0, 120);
}

export async function GET(req: NextRequest) {
  const access = await getAdminAccess();
  if (!access || !canReadUsers(access)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();
  if (!service) {
    const { serviceRoleStatus } = await import("@/lib/eadmin");
    const st = serviceRoleStatus();
    return NextResponse.json(
      { error: st.hint || "No service role" },
      { status: 503 },
    );
  }

  const params = req.nextUrl.searchParams;
  const q = sanitizeSearchTerm(
    params.get("q") || params.get("search") || "",
  );
  const status = (params.get("status") || "all").trim();
  const requestedPage = Math.max(1, Number(params.get("page") || 1) || 1);
  const rawPageSize = Number(params.get("pageSize") || params.get("limit") || 20);
  const pageSize = PAGE_SIZES.has(rawPageSize) ? rawPageSize : 20;

  const buildQuery = () => {
    let query = service
      .from("profiles")
      .select(
        "id, email, display_name, plan, is_premium, trial_ends_at, is_admin_exception, trial_bypassed, account_status, suspended_at, suspended_reason, max_viewer_profiles, created_at, member_reference",
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (status === "active") {
      query = query.or("account_status.eq.active,account_status.is.null");
    } else if (status === "disabled") {
      query = query.in("account_status", ["suspended", "deletion_pending"]);
    } else if (status === "exception") {
      query = query.or(
        "is_admin_exception.eq.true,trial_bypassed.eq.true,plan.eq.exception,plan.eq.admin",
      );
    }

    if (q) {
      const parts = [
        `email.ilike.%${q}%`,
        `display_name.ilike.%${q}%`,
        `member_reference.ilike.%${q}%`,
        `plan.ilike.%${q}%`,
      ];
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          q,
        )
      ) {
        parts.push(`id.eq.${q}`);
      }
      query = query.or(parts.join(","));
    }

    return query;
  };

  let page = requestedPage;
  let rangeStart = (page - 1) * pageSize;
  let rangeEnd = rangeStart + pageSize - 1;
  let { data, error, count } = await buildQuery().range(rangeStart, rangeEnd);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = count ?? 0;
  const maxPage = Math.max(1, Math.ceil(total / pageSize) || 1);
  if (page > maxPage) {
    page = maxPage;
    rangeStart = (page - 1) * pageSize;
    rangeEnd = rangeStart + pageSize - 1;
    ({ data, error, count } = await buildQuery().range(rangeStart, rangeEnd));
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    users: data || [],
    total: count ?? total,
    page,
    pageSize,
    aal: access.aal,
    canManage: canManageUsers(access),
    canOwnerActions: requireOwnerMfa(access),
    needsMfa: !requireAal2(access),
  });
}

export async function POST(req: NextRequest) {
  const access = await getAdminAccess();
  if (!access || !canReadUsers(access)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();
  if (!service) {
    const { serviceRoleStatus } = await import("@/lib/eadmin");
    const st = serviceRoleStatus();
    return NextResponse.json(
      { error: st.hint || "No service role" },
      { status: 503 },
    );
  }

  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action || "");
  const userIds = parseIds(body);

  if (action === "remind") {
    if (!canManageUsers(access)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!userIds.length) {
      return NextResponse.json({ error: "userIds required" }, { status: 400 });
    }
    const customTitle = String(body.title || "").trim().slice(0, 120);
    const customBody = String(body.body || "").trim().slice(0, 800);
    const title = customTitle || "Message from GLS TV";
    const reminderBody =
      customBody ||
      "You have a new message from GLS TV support. Open Pricing or browse to continue.";
    const day = new Date().toISOString().slice(0, 10);
    const inserted: string[] = [];

    for (const userId of userIds) {
      const { data: rem, error } = await service
        .from("user_reminders")
        .insert({
          user_id: userId,
          kind: "admin",
          title,
          body: reminderBody,
          href: "/pricing",
          severity: "info",
          dedupe_key: `manual-admin-${day}-${userId.slice(0, 8)}-${Date.now().toString(36)}`,
          created_by: access.user.email,
        })
        .select("id")
        .single();
      if (!error && rem?.id) inserted.push(rem.id);
    }

    await writeAuditLog(service, {
      actorEmail: access.user.email,
      actorUserId: access.user.id,
      action: "users_send_reminder",
      entityType: "user_reminder",
      entityId: inserted[0] || null,
      summary: `Sent reminder to ${userIds.length} user(s)`,
      meta: { userIds, count: inserted.length },
    });

    return NextResponse.json({ ok: true, count: inserted.length });
  }

  if (action === "grant_exception") {
    if (!canManageUsers(access)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let ids = userIds;
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    if (!ids.length && email.includes("@")) {
      const { data: byProfile } = await service
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (byProfile?.id) {
        ids = [byProfile.id];
      } else {
        const { data: listed } = await service.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        const target = listed.users.find(
          (u) => (u.email || "").toLowerCase() === email,
        );
        if (target) ids = [target.id];
      }
    }

    if (!ids.length) {
      return NextResponse.json(
        { error: "userIds or email required" },
        { status: 400 },
      );
    }

    const { error } = await service
      .from("profiles")
      .update({
        plan: "exception",
        trial_bypassed: true,
        is_admin_exception: true,
        is_premium: true,
        max_viewer_profiles: maxViewerSlots("exception"),
        updated_at: new Date().toISOString(),
      })
      .in("id", ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await writeAuditLog(service, {
      actorEmail: access.user.email,
      actorUserId: access.user.id,
      action: "users_grant_exception",
      entityType: "profile",
      entityId: ids[0],
      summary: `Granted access exception to ${ids.length} user(s)`,
      meta: { userIds: ids, email: email || undefined },
    });

    return NextResponse.json({ ok: true, count: ids.length, userIds: ids });
  }

  if (action === "disable" || action === "enable" || action === "delete") {
    if (!requireOwnerMfa(access)) {
      return NextResponse.json(
        {
          error:
            "Owner role and verified MFA (AAL2) are required for enable/disable/delete.",
        },
        { status: 403 },
      );
    }
    if (!userIds.length) {
      return NextResponse.json({ error: "userIds required" }, { status: 400 });
    }
    if (userIds.includes(access.user.id)) {
      return NextResponse.json(
        { error: "You cannot change your own account status here." },
        { status: 400 },
      );
    }

    const reason = String(body.reason || "").trim().slice(0, 300);
    const status =
      action === "enable"
        ? "active"
        : action === "delete"
          ? "deletion_pending"
          : "suspended";

    try {
      await setAccountStatus(service, userIds, status, reason || null);
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Failed to update account status",
        },
        { status: 500 },
      );
    }

    await writeAuditLog(service, {
      actorEmail: access.user.email,
      actorUserId: access.user.id,
      action: `users_${action}`,
      entityType: "user",
      entityId: userIds[0],
      summary:
        action === "enable"
          ? `Enabled ${userIds.length} user(s)`
          : action === "delete"
            ? `Marked ${userIds.length} user(s) for deletion`
            : `Disabled ${userIds.length} user(s)`,
      meta: { userIds, reason: reason || undefined, account_status: status },
    });

    return NextResponse.json({ ok: true, count: userIds.length, status });
  }

  if (action === "update_email") {
    if (!canManageUsers(access) || !requireAal2(access)) {
      return NextResponse.json(
        {
          error:
            "Support/finance permission and verified MFA (AAL2) are required to change email.",
        },
        { status: 403 },
      );
    }
    const userId = userIds[0];
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    if (!userId || !email.includes("@")) {
      return NextResponse.json(
        { error: "userId and valid email required" },
        { status: 400 },
      );
    }

    const { data: conflict } = await service
      .from("profiles")
      .select("id")
      .eq("email", email)
      .neq("id", userId)
      .maybeSingle();
    if (conflict?.id) {
      return NextResponse.json(
        { error: "Another profile already uses that email" },
        { status: 409 },
      );
    }

    const { error: authError } = await service.auth.admin.updateUserById(
      userId,
      {
        email,
        email_confirm: true,
      },
    );
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    const { error: profileError } = await service
      .from("profiles")
      .update({ email, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    await writeAuditLog(service, {
      actorEmail: access.user.email,
      actorUserId: access.user.id,
      action: "users_update_email",
      entityType: "user",
      entityId: userId,
      summary: `Updated email to ${email}`,
      meta: { email },
    });

    return NextResponse.json({ ok: true, email });
  }

  if (action === "set_password") {
    if (!canManageUsers(access) || !requireAal2(access)) {
      return NextResponse.json(
        {
          error:
            "Support/finance permission and verified MFA (AAL2) are required to set passwords.",
        },
        { status: 403 },
      );
    }
    const userId = userIds[0];
    const password = String(body.password || "");
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const { error } = await service.auth.admin.updateUserById(userId, {
      password,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await writeAuditLog(service, {
      actorEmail: access.user.email,
      actorUserId: access.user.id,
      action: "users_set_password",
      entityType: "user",
      entityId: userId,
      summary: "Admin set password",
      meta: {},
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

import { NextRequest, NextResponse } from "next/server";
import {
  getAdminAccess,
  hasAdminPermission,
  requireAal2,
  type AdminRole,
} from "@/lib/admin/access";
import { createServiceClient } from "@/lib/eadmin";
import { writeAuditLog } from "@/lib/admin/audit";

const ROLES: AdminRole[] = ["owner", "finance", "support", "catalog", "ops"];

export async function GET() {
  const access = await getAdminAccess();
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Admin service unavailable" }, { status: 503 });
  const [{ data: roles }, { data: flags }] = await Promise.all([
    service.from("admin_roles").select("user_id, role, granted_at, revoked_at").order("granted_at", { ascending: false }),
    service.from("feature_flags").select("key, enabled, reason, updated_at").order("key"),
  ]);
  const { data: users } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emails = new Map(users.users.map((user) => [user.id, user.email || null]));
  return NextResponse.json({
    current: { roles: access.roles, aal: access.aal, bootstrapOwner: access.bootstrapOwner },
    assignments: (roles || []).map((row) => ({ ...row, email: emails.get(row.user_id) || null })),
    flags: flags || [],
  });
}

export async function POST(req: NextRequest) {
  const access = await getAdminAccess();
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Admin service unavailable" }, { status: 503 });
  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action || "");

  if (["grant_role", "revoke_role"].includes(action)) {
    if (!hasAdminPermission(access, "roles.manage") || !requireAal2(access)) {
      return NextResponse.json({ error: "Owner permission and verified MFA (AAL2) are required" }, { status: 403 });
    }
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "") as AdminRole;
    if (!email.includes("@") || !ROLES.includes(role)) {
      return NextResponse.json({ error: "Valid email and role are required" }, { status: 400 });
    }
    const { data: listed } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const target = listed.users.find((user) => user.email?.toLowerCase() === email);
    if (!target) return NextResponse.json({ error: "No user has that email" }, { status: 404 });
    if (action === "grant_role") {
      await service.from("admin_roles").upsert({
        user_id: target.id,
        role,
        granted_by: access.user.id,
        granted_at: new Date().toISOString(),
        revoked_at: null,
      });
    } else {
      await service.from("admin_roles").update({ revoked_at: new Date().toISOString() }).eq("user_id", target.id).eq("role", role);
    }
    await writeAuditLog(service, {
      actorEmail: access.user.email,
      actorUserId: access.user.id,
      action: `admin_role.${action === "grant_role" ? "granted" : "revoked"}`,
      entityType: "admin_role",
      entityId: `${target.id}:${role}`,
      summary: `${action === "grant_role" ? "Granted" : "Revoked"} ${role} role`,
      meta: { targetUserId: target.id, role },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "set_feature") {
    if (!access.roles.includes("owner") || !requireAal2(access)) {
      return NextResponse.json({ error: "Owner role and verified MFA (AAL2) are required" }, { status: 403 });
    }
    const key = String(body.key || "");
    if (!["payments", "playlist_imports", "hls_proxy", "catalog_publish", "signups"].includes(key)) {
      return NextResponse.json({ error: "Unknown feature" }, { status: 400 });
    }
    const enabled = body.enabled === true;
    await service.from("feature_flags").update({
      enabled,
      reason: String(body.reason || "").slice(0, 300) || null,
      updated_by: access.user.id,
      updated_at: new Date().toISOString(),
    }).eq("key", key);
    await writeAuditLog(service, {
      actorEmail: access.user.email,
      actorUserId: access.user.id,
      action: "feature_flag.changed",
      entityType: "feature_flag",
      entityId: key,
      summary: `${enabled ? "Enabled" : "Disabled"} ${key}`,
      meta: { enabled },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "suspend" || action === "reactivate") {
    if (!access.roles.includes("owner") || !requireAal2(access)) {
      return NextResponse.json({ error: "Owner role and verified MFA (AAL2) are required" }, { status: 403 });
    }
    const userId = String(body.userId || "");
    const suspended = action === "suspend";
    const reason = String(body.reason || "").slice(0, 300);
    await service.from("profiles").update({
      account_status: suspended ? "suspended" : "active",
      suspended_at: suspended ? new Date().toISOString() : null,
      suspended_reason: suspended ? reason || "Administrative suspension" : null,
    }).eq("id", userId);
    await service.auth.admin.updateUserById(userId, {
      ban_duration: suspended ? "876000h" : "none",
    });
    await writeAuditLog(service, {
      actorEmail: access.user.email,
      actorUserId: access.user.id,
      action: `account.${action}`,
      entityType: "user",
      entityId: userId,
      summary: suspended ? "Suspended account" : "Reactivated account",
      meta: { reason: suspended ? reason : undefined },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, isEadminEmail } from "@/lib/eadmin";

export type AdminRole = "owner" | "finance" | "support" | "catalog" | "ops";
export type AdminPermission =
  | "admin.access"
  | "roles.manage"
  | "finance.read"
  | "finance.write"
  | "support.write"
  | "catalog.write"
  | "catalog.publish"
  | "ops.write";

const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  owner: [
    "admin.access",
    "roles.manage",
    "finance.read",
    "finance.write",
    "support.write",
    "catalog.write",
    "catalog.publish",
    "ops.write",
  ],
  finance: ["admin.access", "finance.read", "finance.write"],
  support: ["admin.access", "support.write"],
  catalog: ["admin.access", "catalog.write", "catalog.publish"],
  ops: ["admin.access", "ops.write"],
};

export type AdminAccess = {
  user: User;
  roles: AdminRole[];
  bootstrapOwner: boolean;
  aal: string | null;
};

export async function getAdminAccess(user?: User | null): Promise<AdminAccess | null> {
  let current = user;
  const auth = await createClient();
  if (!current) {
    const {
      data: { user: sessionUser },
    } = await auth.auth.getUser();
    current = sessionUser;
  }
  if (!current) return null;

  const bootstrapOwner = isEadminEmail(current.email);
  const service = createServiceClient();
  let roles: AdminRole[] = bootstrapOwner ? ["owner"] : [];
  if (service) {
    const { data } = await service
      .from("admin_roles")
      .select("role")
      .eq("user_id", current.id)
      .is("revoked_at", null);
    roles = [...new Set([...roles, ...((data || []).map((row) => row.role) as AdminRole[])])];
  }
  if (!roles.length) return null;

  const { data: aal } = await auth.auth.mfa.getAuthenticatorAssuranceLevel();
  return {
    user: current,
    roles,
    bootstrapOwner,
    aal: aal?.currentLevel || null,
  };
}

export function hasAdminPermission(
  access: AdminAccess,
  permission: AdminPermission,
) {
  return access.roles.some((role) => ROLE_PERMISSIONS[role].includes(permission));
}

export function requireAal2(access: AdminAccess) {
  return access.aal === "aal2";
}

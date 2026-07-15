import { createClient } from "@/lib/supabase/server";
import { getAdminAccess } from "@/lib/admin/access";
import { redirect } from "next/navigation";

export async function requireAdmin() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/auth?next=/admin");
  const access = await getAdminAccess(user);
  if (!access) redirect("/browse");
  return user;
}

export async function getIsAdminClientHint(email: string | null | undefined) {
  if (!email) return false;
  return Boolean(await getAdminAccess());
}

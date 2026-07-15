import { createClient } from "@/lib/supabase/server";
import { isEadminEmail } from "@/lib/eadmin";
import { redirect } from "next/navigation";

export async function requireAdmin() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/auth?next=/admin");
  if (!isEadminEmail(user.email)) redirect("/browse");
  return user;
}

export async function getIsAdminClientHint(email: string | null | undefined) {
  return isEadminEmail(email);
}

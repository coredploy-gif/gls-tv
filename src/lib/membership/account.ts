import { createClient } from "@/lib/supabase/server";
import { createServiceClient, isEadminEmail } from "@/lib/eadmin";
import {
  adultLimitForPlan,
  maxViewerSlots,
  type GlsPlanId,
} from "@/lib/membership/plans";
import { hashDevice, hashIp, trialBlockUntil } from "@/lib/membership/device";

export type AccountProfile = {
  id: string;
  display_name: string | null;
  email: string | null;
  plan: GlsPlanId | string;
  trial_ends_at: string | null;
  trial_bypassed: boolean;
  is_admin_exception: boolean;
  is_premium: boolean;
  max_viewer_profiles: number;
};

export type ViewerProfile = {
  id: string;
  user_id: string;
  name: string;
  avatar_id: string;
  is_kids: boolean;
  sort_order: number;
  avatar_url?: string | null;
};

export async function getAccountProfile(
  userId: string,
): Promise<AccountProfile | null> {
  const sb = await createClient();
  const { data } = await sb
    .from("profiles")
    .select(
      "id, display_name, email, plan, trial_ends_at, trial_bypassed, is_admin_exception, is_premium, max_viewer_profiles",
    )
    .eq("id", userId)
    .maybeSingle();
  return (data as AccountProfile | null) ?? null;
}

export function accountHasAccess(account: AccountProfile | null, email?: string | null) {
  if (!account) return false;
  if (isEadminEmail(email || account.email)) return true;
  if (account.trial_bypassed || account.is_admin_exception || account.is_premium)
    return true;
  if (account.plan === "exception" || account.plan === "admin") return true;
  if (account.trial_ends_at) {
    return new Date(account.trial_ends_at).getTime() > Date.now();
  }
  return false;
}

export async function listViewerProfiles(userId: string): Promise<ViewerProfile[]> {
  const sb = await createClient();
  const { data: viewers } = await sb
    .from("viewer_profiles")
    .select("id, user_id, name, avatar_id, is_kids, sort_order")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });

  const rows = (viewers || []) as ViewerProfile[];
  if (!rows.length) return rows;

  const ids = [...new Set(rows.map((r) => r.avatar_id))];
  const { data: avatars } = await sb
    .from("avatar_catalog")
    .select("id, url, thumb_url")
    .in("id", ids);

  const map = new Map(
    (avatars || []).map((a) => [a.id as string, (a.thumb_url || a.url) as string]),
  );

  return rows.map((r) => ({
    ...r,
    avatar_url: map.get(r.avatar_id) || null,
  }));
}

export async function listAvatarCatalog() {
  const sb = await createClient();
  const { data } = await sb
    .from("avatar_catalog")
    .select("id, title, url, thumb_url, is_kids, sort_order, category")
    .order("sort_order", { ascending: true });
  return data || [];
}

/**
 * Start or attach trial; enforce device/IP lock.
 * Paid / exception / admin bypass.
 * Returns { ok, reason? }.
 */
export async function claimTrialForDevice(opts: {
  userId: string;
  email: string | null;
  deviceId: string;
  ip: string | null;
}): Promise<{ ok: boolean; reason?: string; blockedUntil?: string }> {
  if (isEadminEmail(opts.email)) {
    return { ok: true };
  }

  const service = createServiceClient();
  if (!service) return { ok: true }; // fail-open if no service key in dev

  const { data: account } = await service
    .from("profiles")
    .select(
      "plan, trial_bypassed, is_admin_exception, is_premium, trial_ends_at",
    )
    .eq("id", opts.userId)
    .maybeSingle();

  if (
    account?.trial_bypassed ||
    account?.is_admin_exception ||
    account?.is_premium ||
    account?.plan === "gls_55" ||
    account?.plan === "gls_65" ||
    account?.plan === "gls_75" ||
    account?.plan === "exception" ||
    account?.plan === "admin"
  ) {
    return { ok: true };
  }

  const deviceHash = hashDevice(opts.deviceId || opts.userId);
  const ipHash = hashIp(opts.ip);
  const now = new Date();

  const { data: byDevice } = await service
    .from("trial_device_claims")
    .select("user_id, email, blocked_until")
    .eq("device_hash", deviceHash)
    .maybeSingle();

  if (byDevice?.blocked_until && new Date(byDevice.blocked_until) > now) {
    if (byDevice.user_id && byDevice.user_id !== opts.userId) {
      return {
        ok: false,
        reason:
          "This device already used a free trial with another email. Wait until the block ends, pay for a plan, or ask admin for an exception.",
        blockedUntil: byDevice.blocked_until as string,
      };
    }
  }

  if (ipHash) {
    const { data: byIp } = await service
      .from("trial_device_claims")
      .select("user_id, email, blocked_until")
      .eq("ip_hash", ipHash)
      .gt("blocked_until", now.toISOString())
      .neq("user_id", opts.userId)
      .limit(1)
      .maybeSingle();

    if (byIp?.user_id) {
      return {
        ok: false,
        reason:
          "A free trial was already started from this network. Use the original account, subscribe, or ask admin for an exception.",
        blockedUntil: byIp.blocked_until as string,
      };
    }
  }

  const blockedUntil = trialBlockUntil(now).toISOString();

  await service.from("trial_device_claims").upsert(
    {
      device_hash: deviceHash,
      ip_hash: ipHash,
      user_id: opts.userId,
      email: opts.email,
      claimed_at: now.toISOString(),
      blocked_until: blockedUntil,
    },
    { onConflict: "device_hash" },
  );

  // Ensure trial window on profile
  if (!account?.trial_ends_at) {
    await service
      .from("profiles")
      .update({
        plan: "trial",
        trial_started_at: now.toISOString(),
        trial_ends_at: blockedUntil,
        max_viewer_profiles: maxViewerSlots("trial"),
      })
      .eq("id", opts.userId);
  }

  return { ok: true };
}

export async function ensureDefaultViewers(userId: string, email?: string | null) {
  const existing = await listViewerProfiles(userId);
  if (existing.length) return existing;

  const service = createServiceClient();
  const sb = service || (await createClient());
  const name = email?.split("@")[0] || "You";
  await sb.from("viewer_profiles").insert([
    {
      user_id: userId,
      name,
      avatar_id: "avatar-01",
      is_kids: false,
      sort_order: 0,
    },
    {
      user_id: userId,
      name: "Kids",
      avatar_id: "avatar-kids-01",
      is_kids: true,
      sort_order: 99,
    },
  ]);
  return listViewerProfiles(userId);
}

export function planCopyLimits(plan: string | null | undefined) {
  return {
    adults: adultLimitForPlan(plan),
    total: maxViewerSlots(plan),
  };
}

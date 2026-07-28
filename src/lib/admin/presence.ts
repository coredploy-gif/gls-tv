import type { SupabaseClient } from "@supabase/supabase-js";

/** UI “online” window (tighter than the 30m device-slot TTL). */
export const PRESENCE_ONLINE_MS = 15 * 60_000;
/** UI “watching” window — recent HLS/stream activity. */
export const PRESENCE_WATCHING_MS = 5 * 60_000;

export type PresenceStatus = "watching" | "online" | "offline";

export type UserPresence = {
  status: PresenceStatus;
  lastActiveAt: string | null;
  lastStreamAt: string | null;
  lastSignInAt: string | null;
  activeSessions: number;
};

export type PresenceSummary = {
  online: number;
  watching: number;
  asOf: string;
};

function sinceIso(ms: number) {
  return new Date(Date.now() - ms).toISOString();
}

function maxIso(a: string | null | undefined, b: string | null | undefined) {
  if (!a) return b || null;
  if (!b) return a;
  return a > b ? a : b;
}

function statusFromTimes(
  lastActiveAt: string | null,
  lastStreamAt: string | null,
): PresenceStatus {
  const watching =
    lastStreamAt &&
    new Date(lastStreamAt).getTime() >= Date.now() - PRESENCE_WATCHING_MS;
  if (watching) return "watching";
  const online =
    lastActiveAt &&
    new Date(lastActiveAt).getTime() >= Date.now() - PRESENCE_ONLINE_MS;
  return online ? "online" : "offline";
}

export async function loadPresenceSummary(
  service: SupabaseClient,
): Promise<PresenceSummary> {
  const onlineSince = sinceIso(PRESENCE_ONLINE_MS);
  const watchingSince = sinceIso(PRESENCE_WATCHING_MS);
  const asOf = new Date().toISOString();

  const [
    { data: onlineSessions },
    { data: watchingSessions },
    { data: onlineProfiles },
    { data: watchingProfiles },
  ] = await Promise.all([
    service
      .from("viewer_device_sessions")
      .select("user_id")
      .is("revoked_at", null)
      .gte("last_active_at", onlineSince)
      .limit(5000),
    service
      .from("viewer_device_sessions")
      .select("user_id")
      .is("revoked_at", null)
      .gte("last_stream_at", watchingSince)
      .limit(5000),
    service
      .from("profiles")
      .select("id")
      .gte("last_seen_at", onlineSince)
      .limit(5000),
    service
      .from("profiles")
      .select("id")
      .gte("last_stream_at", watchingSince)
      .limit(5000),
  ]);

  const online = new Set<string>([
    ...(onlineSessions || []).map((r) => r.user_id as string),
    ...(onlineProfiles || []).map((r) => r.id as string),
  ]);
  const watching = new Set<string>([
    ...(watchingSessions || []).map((r) => r.user_id as string),
    ...(watchingProfiles || []).map((r) => r.id as string),
  ]);

  return {
    online: online.size,
    watching: watching.size,
    asOf,
  };
}

export async function loadPresenceForUserIds(
  service: SupabaseClient,
  userIds: string[],
): Promise<Map<string, UserPresence>> {
  const map = new Map<string, UserPresence>();
  for (const id of userIds) {
    map.set(id, {
      status: "offline",
      lastActiveAt: null,
      lastStreamAt: null,
      lastSignInAt: null,
      activeSessions: 0,
    });
  }
  if (!userIds.length) return map;

  const onlineSince = sinceIso(PRESENCE_ONLINE_MS);

  const [{ data: sessions }, { data: profiles }] = await Promise.all([
    service
      .from("viewer_device_sessions")
      .select("user_id, last_active_at, last_stream_at")
      .in("user_id", userIds)
      .is("revoked_at", null)
      .limit(2000),
    service
      .from("profiles")
      .select("id, last_seen_at, last_stream_at")
      .in("id", userIds),
  ]);

  for (const row of sessions || []) {
    const cur = map.get(row.user_id);
    if (!cur) continue;
    if (
      row.last_active_at &&
      new Date(row.last_active_at).getTime() >= Date.now() - PRESENCE_ONLINE_MS
    ) {
      cur.activeSessions += 1;
    }
    cur.lastActiveAt = maxIso(cur.lastActiveAt, row.last_active_at);
    cur.lastStreamAt = maxIso(cur.lastStreamAt, row.last_stream_at);
  }

  for (const row of profiles || []) {
    const cur = map.get(row.id);
    if (!cur) continue;
    cur.lastActiveAt = maxIso(cur.lastActiveAt, row.last_seen_at);
    cur.lastStreamAt = maxIso(cur.lastStreamAt, row.last_stream_at);
  }

  for (const [id, cur] of map) {
    cur.status = statusFromTimes(cur.lastActiveAt, cur.lastStreamAt);
    map.set(id, cur);
  }

  void onlineSince;
  return map;
}

/** Active online/watching user id sets for list filters. */
export async function loadPresenceUserIdSets(service: SupabaseClient) {
  const onlineSince = sinceIso(PRESENCE_ONLINE_MS);
  const watchingSince = sinceIso(PRESENCE_WATCHING_MS);
  const [
    { data: onlineSessions },
    { data: watchingSessions },
    { data: onlineProfiles },
    { data: watchingProfiles },
  ] = await Promise.all([
    service
      .from("viewer_device_sessions")
      .select("user_id")
      .is("revoked_at", null)
      .gte("last_active_at", onlineSince)
      .limit(5000),
    service
      .from("viewer_device_sessions")
      .select("user_id")
      .is("revoked_at", null)
      .gte("last_stream_at", watchingSince)
      .limit(5000),
    service
      .from("profiles")
      .select("id")
      .gte("last_seen_at", onlineSince)
      .limit(5000),
    service
      .from("profiles")
      .select("id")
      .gte("last_stream_at", watchingSince)
      .limit(5000),
  ]);
  return {
    online: new Set<string>([
      ...(onlineSessions || []).map((r) => r.user_id as string),
      ...(onlineProfiles || []).map((r) => r.id as string),
    ]),
    watching: new Set<string>([
      ...(watchingSessions || []).map((r) => r.user_id as string),
      ...(watchingProfiles || []).map((r) => r.id as string),
    ]),
  };
}

export async function loadLastSignInAt(
  service: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  await Promise.all(
    userIds.map(async (id) => {
      try {
        const { data, error } = await service.auth.admin.getUserById(id);
        if (error || !data.user) {
          out.set(id, null);
          return;
        }
        out.set(id, data.user.last_sign_in_at ?? null);
      } catch {
        out.set(id, null);
      }
    }),
  );
  return out;
}

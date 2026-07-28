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

export async function loadPresenceSummary(
  service: SupabaseClient,
): Promise<PresenceSummary> {
  const onlineSince = sinceIso(PRESENCE_ONLINE_MS);
  const watchingSince = sinceIso(PRESENCE_WATCHING_MS);
  const asOf = new Date().toISOString();

  const [{ data: onlineRows }, { data: watchingRows }] = await Promise.all([
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
  ]);

  return {
    online: new Set((onlineRows || []).map((r) => r.user_id)).size,
    watching: new Set((watchingRows || []).map((r) => r.user_id)).size,
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
  const watchingSince = sinceIso(PRESENCE_WATCHING_MS);

  const { data: sessions } = await service
    .from("viewer_device_sessions")
    .select("user_id, last_active_at, last_stream_at")
    .in("user_id", userIds)
    .is("revoked_at", null)
    .gte("last_active_at", onlineSince)
    .limit(2000);

  for (const row of sessions || []) {
    const cur = map.get(row.user_id) || {
      status: "offline" as PresenceStatus,
      lastActiveAt: null,
      lastStreamAt: null,
      lastSignInAt: null,
      activeSessions: 0,
    };
    cur.activeSessions += 1;
    if (
      !cur.lastActiveAt ||
      (row.last_active_at && row.last_active_at > cur.lastActiveAt)
    ) {
      cur.lastActiveAt = row.last_active_at;
    }
    if (
      row.last_stream_at &&
      (!cur.lastStreamAt || row.last_stream_at > cur.lastStreamAt)
    ) {
      cur.lastStreamAt = row.last_stream_at;
    }
    const watching =
      cur.lastStreamAt &&
      new Date(cur.lastStreamAt).getTime() >=
        Date.now() - PRESENCE_WATCHING_MS;
    cur.status = watching ? "watching" : "online";
    map.set(row.user_id, cur);
  }

  // Also surface last historical activity for offline rows (best-effort).
  const offlineIds = userIds.filter((id) => map.get(id)?.status === "offline");
  if (offlineIds.length) {
    const { data: recent } = await service
      .from("viewer_device_sessions")
      .select("user_id, last_active_at, last_stream_at")
      .in("user_id", offlineIds)
      .order("last_active_at", { ascending: false })
      .limit(offlineIds.length * 3);
    for (const row of recent || []) {
      const cur = map.get(row.user_id);
      if (!cur || cur.lastActiveAt) continue;
      cur.lastActiveAt = row.last_active_at;
      cur.lastStreamAt = row.last_stream_at;
    }
  }

  void watchingSince;
  return map;
}

/** Active online/watching user id sets for list filters. */
export async function loadPresenceUserIdSets(service: SupabaseClient) {
  const onlineSince = sinceIso(PRESENCE_ONLINE_MS);
  const watchingSince = sinceIso(PRESENCE_WATCHING_MS);
  const [{ data: onlineRows }, { data: watchingRows }] = await Promise.all([
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
  ]);
  return {
    online: new Set((onlineRows || []).map((r) => r.user_id as string)),
    watching: new Set((watchingRows || []).map((r) => r.user_id as string)),
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

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { ACTIVE_VIEWER_COOKIE } from "@/lib/membership/plans";
import {
  getAccountEntitlement,
  listViewerProfiles,
} from "@/lib/membership/account";
import type { AppNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILTERS = new Set(["all", "unread", "billing", "support", "system", "activity", "sports"]);

function matchesFilter(
  item: AppNotification,
  filter: string,
  readIds: Set<string>,
) {
  if (filter === "all") return true;
  if (filter === "unread") return !readIds.has(item.id);
  if (filter === "billing") return item.kind === "billing" || item.kind === "account";
  if (filter === "support") {
    return (
      item.kind === "reminder" &&
      (item.href?.includes("/support") || item.id.startsWith("rem-"))
    ) || item.title.toLowerCase().includes("support");
  }
  if (filter === "system") return item.kind === "system" || item.kind === "reminder";
  if (filter === "activity") return item.kind === "activity";
  if (filter === "sports") return item.kind === "sports";
  return true;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const filter = String(req.nextUrl.searchParams.get("filter") || "all").toLowerCase();
  const safeFilter = FILTERS.has(filter) ? filter : "all";
  const limit = Math.min(
    100,
    Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 40) || 40),
  );
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") || 0) || 0);

  const items: AppNotification[] = [];
  const now = Date.now();

  if (!user) {
    items.push({
      id: "guest-signin",
      title: "Sign in to sync",
      body: "Create an account to keep watch history and profiles.",
      href: "/auth",
      createdAt: now,
      kind: "account",
    });
    return NextResponse.json({
      items,
      readIds: [],
      dismissedIds: [],
      filter: safeFilter,
      hasMore: false,
    });
  }

  const [{ data: preferences }, { data: states }] = await Promise.all([
    sb
      .from("notification_preferences")
      .select("sports, activity, product")
      .eq("user_id", user.id)
      .maybeSingle(),
    sb
      .from("notification_states")
      .select("notification_id, read_at, dismissed_at")
      .eq("user_id", user.id),
  ]);
  const dismissed = new Set(
    (states || []).filter((row) => row.dismissed_at).map((row) => row.notification_id),
  );
  const readIds = new Set(
    (states || []).filter((row) => row.read_at).map((row) => row.notification_id),
  );

  const jar = await cookies();
  const viewerId = jar.get(ACTIVE_VIEWER_COOKIE)?.value;
  const viewers = await listViewerProfiles(user.id);
  const viewer = viewers.find((v) => v.id === viewerId);

  if (viewer) {
    items.push({
      id: `watching-as-${viewer.id}`,
      title: `Watching as ${viewer.name}`,
      body: viewer.is_kids
        ? "Kids profile is active. Switch anytime from your avatar."
        : "Your list and continue watching are saved to this profile.",
      href: "/profiles",
      createdAt: now - 60_000,
      kind: "activity",
    });
  } else {
    items.push({
      id: "pick-profile",
      title: "Who's watching?",
      body: "Pick a profile to personalize Home and My List.",
      href: "/profiles",
      createdAt: now,
      kind: "activity",
    });
  }

  const entitlement = await getAccountEntitlement(user.id, user.email);
  const account = entitlement.account;
  if (account?.plan === "trial" && account.trial_ends_at) {
    const ends = new Date(account.trial_ends_at).getTime();
    const days = Math.ceil((ends - now) / 86_400_000);
    if (days >= 0 && days <= 14) {
      items.push({
        id: `trial-${account.trial_ends_at}`,
        title: days <= 2 ? "Trial ending soon" : `${days} days left on trial`,
        body: "Renew for 30 days with PayFast (card debit) or verified EFT to keep watching.",
        href: "/pricing",
        createdAt: now - 120_000,
        kind: "billing",
        severity: days <= 2 ? "urgent" : "warn",
      });
    }
  } else if (!entitlement.allowed) {
    items.push({
      id: "trial-ended",
      title: "Trial ended",
      body: "Choose a plan to unlock profiles and continue watching.",
      href: "/pricing",
      createdAt: now,
      kind: "billing",
      severity: "urgent",
    });
  }

  try {
    const { data: reminders } = await sb
      .from("user_reminders")
      .select("id, kind, title, body, href, severity, due_at, created_at")
      .eq("user_id", user.id)
      .is("dismissed_at", null)
      .lte("due_at", new Date(now).toISOString())
      .order("due_at", { ascending: false })
      .limit(30);

    for (const r of reminders || []) {
      const billingKinds = new Set([
        "trial_ending",
        "trial_ended",
        "past_due",
        "renewal",
        "payment_failed",
      ]);
      const supportKinds = new Set(["ticket_reply", "support"]);
      const kind: AppNotification["kind"] = billingKinds.has(r.kind)
        ? "billing"
        : supportKinds.has(r.kind)
          ? "reminder"
          : "reminder";
      items.push({
        id: `rem-${r.id}`,
        title: r.title,
        body: r.body,
        href: r.href || (supportKinds.has(r.kind) ? "/support" : "/pricing"),
        createdAt: new Date(r.due_at || r.created_at).getTime(),
        kind,
        severity: (r.severity as "info" | "warn" | "urgent") || "info",
      });
    }
  } catch {
    /* table may be missing until migration */
  }

  try {
    const { getTodaysMatches } = await import("@/lib/matchday");
    const data = await getTodaysMatches({ limit: 8 });
    for (const m of data.matches.filter((x) => x.status === "live").slice(0, 2)) {
      items.push({
        id: `live-${m.id}`,
        title: `Live · ${m.league}`,
        body: m.title,
        href: "/sports",
        createdAt: now,
        kind: "sports",
      });
    }
  } catch {
    /* ignore */
  }

  const filtered = items
    .filter((item) => {
      if (dismissed.has(item.id)) return false;
      if (item.kind === "sports" && preferences?.sports === false) return false;
      if (item.kind === "activity" && preferences?.activity === false) return false;
      return matchesFilter(item, safeFilter, readIds);
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  const page = filtered.slice(offset, offset + limit);
  return NextResponse.json({
    items: page,
    readIds: [...readIds],
    dismissedIds: [...dismissed],
    filter: safeFilter,
    total: filtered.length,
    hasMore: offset + limit < filtered.length,
  });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const body = (await req.json()) as { ids?: unknown; action?: unknown };
  const ids = Array.isArray(body.ids)
    ? body.ids.map(String).filter((id) => id.length > 0 && id.length <= 240).slice(0, 100)
    : [];
  const action = String(body.action || "read");
  if (!ids.length || !["read", "dismiss"].includes(action)) {
    return NextResponse.json({ error: "Invalid notification update" }, { status: 400 });
  }
  const now = new Date().toISOString();
  const rows = ids.map((notificationId) => {
    if (action === "dismiss") {
      return {
        user_id: user.id,
        notification_id: notificationId,
        read_at: now,
        dismissed_at: now,
        updated_at: now,
      };
    }
    return {
      user_id: user.id,
      notification_id: notificationId,
      read_at: now,
      updated_at: now,
    };
  });
  const { error } = await sb.from("notification_states").upsert(rows);
  return error
    ? NextResponse.json({ error: "Notification state could not be saved" }, { status: 500 })
    : NextResponse.json({ ok: true, action, ids });
}

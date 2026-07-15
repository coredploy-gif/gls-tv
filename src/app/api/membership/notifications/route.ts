import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { ACTIVE_VIEWER_COOKIE } from "@/lib/membership/plans";
import {
  accountHasAccess,
  getAccountProfile,
  listViewerProfiles,
} from "@/lib/membership/account";
import type { AppNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

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
    return NextResponse.json({ items });
  }

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
      title: "Who’s watching?",
      body: "Pick a profile to personalize Home and My List.",
      href: "/profiles",
      createdAt: now,
      kind: "activity",
    });
  }

  const account = await getAccountProfile(user.id);
  if (account?.plan === "trial" && account.trial_ends_at) {
    const ends = new Date(account.trial_ends_at).getTime();
    const days = Math.ceil((ends - now) / 86_400_000);
    if (days >= 0 && days <= 14) {
      items.push({
        id: `trial-${account.trial_ends_at}`,
        title:
          days <= 2 ? "Trial ending soon" : `${days} days left on trial`,
        body: "Add a card on Plans to keep watching after your free trial.",
        href: "/pricing",
        createdAt: now - 120_000,
        kind: "account",
        severity: days <= 2 ? "urgent" : "warn",
      });
    }
  } else if (!accountHasAccess(account, user.email)) {
    items.push({
      id: "trial-ended",
      title: "Trial ended",
      body: "Choose a plan to unlock profiles and continue watching.",
      href: "/pricing",
      createdAt: now,
      kind: "account",
      severity: "urgent",
    });
  }

  // DB reminders (admin nudges, collections, renewals, ticket replies)
  try {
    const { data: reminders } = await sb
      .from("user_reminders")
      .select("id, kind, title, body, href, severity, due_at, created_at")
      .eq("user_id", user.id)
      .is("dismissed_at", null)
      .lte("due_at", new Date(now).toISOString())
      .order("due_at", { ascending: false })
      .limit(15);

    for (const r of reminders || []) {
      const billingKinds = new Set([
        "trial_ending",
        "trial_ended",
        "past_due",
        "renewal",
        "payment_failed",
      ]);
      items.push({
        id: `rem-${r.id}`,
        title: r.title,
        body: r.body,
        href: r.href || "/pricing",
        createdAt: new Date(r.due_at || r.created_at).getTime(),
        kind: billingKinds.has(r.kind) ? "billing" : "reminder",
        severity: (r.severity as "info" | "warn" | "urgent") || "info",
      });
    }
  } catch {
    /* table may be missing until migration */
  }

  // Live sports pulse (best-effort)
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

  items.sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ items: items.slice(0, 24) });
}

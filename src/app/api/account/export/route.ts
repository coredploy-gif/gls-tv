import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/eadmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Export service unavailable" }, { status: 503 });

  const [profile, viewers, playlists, reminders, tickets, payments, receipts] =
    await Promise.all([
      service.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      service.from("viewer_profiles").select("id, name, avatar_id, is_kids, created_at, updated_at").eq("user_id", user.id),
      service.from("user_playlists").select("id, name, channel_count, status, created_at, updated_at, last_synced_at").eq("user_id", user.id),
      service.from("user_reminders").select("kind, title, due_at, read_at, dismissed_at, created_at").eq("user_id", user.id),
      service.from("helpdesk_tickets").select("id, ticket_number, subject, status, priority, category, created_at, updated_at").eq("requester_user_id", user.id),
      service.from("manual_payment_requests").select("id, plan, amount_zar_cents, currency, payment_method, status, created_at, paid_at, membership_starts_at, membership_ends_at").eq("user_id", user.id),
      service.from("payment_receipts").select("receipt_number, plan, amount_zar_cents, currency, payment_method, membership_starts_at, membership_ends_at, paid_at, issued_at, refunded_at").eq("user_id", user.id),
    ]);

  const payload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
      profile: profile.data,
    },
    viewers: viewers.data || [],
    playlists: playlists.data || [],
    notifications: reminders.data || [],
    supportTickets: tickets.data || [],
    payments: payments.data || [],
    receipts: receipts.data || [],
    redactions: [
      "Playlist source URLs and stream URLs are omitted because they may contain provider credentials.",
      "Support message bodies are available in the support thread and omitted from this portable summary.",
    ],
  };
  return NextResponse.json(payload, {
    headers: {
      "Content-Disposition": `attachment; filename="gls-tv-data-${user.id}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

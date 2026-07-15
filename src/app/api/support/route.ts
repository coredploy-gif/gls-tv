import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/eadmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function member() {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  return { user, service: createServiceClient() };
}

export async function GET(req: NextRequest) {
  const { user, service } = await member();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!service) return NextResponse.json({ error: "Support service unavailable" }, { status: 503 });
  const ticketId = req.nextUrl.searchParams.get("ticket");
  if (!ticketId) {
    const { data, error } = await service
      .from("helpdesk_tickets")
      .select("id, ticket_number, subject, status, priority, category, created_at, updated_at")
      .eq("requester_user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(100);
    return error
      ? NextResponse.json({ error: "Tickets could not be loaded" }, { status: 500 })
      : NextResponse.json({ tickets: data || [] });
  }

  const { data: ticket } = await service
    .from("helpdesk_tickets")
    .select("id, ticket_number, subject, status, priority, category, created_at, updated_at")
    .eq("id", ticketId)
    .eq("requester_user_id", user.id)
    .maybeSingle();
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  const [{ data: messages }, { data: history }] = await Promise.all([
    service
      .from("helpdesk_messages")
      .select("id, author_type, body, created_at")
      .eq("ticket_id", ticket.id)
      .order("created_at"),
    service
      .from("helpdesk_status_history")
      .select("id, from_status, to_status, actor_type, created_at")
      .eq("ticket_id", ticket.id)
      .order("created_at"),
  ]);
  return NextResponse.json({ ticket, messages: messages || [], history: history || [] });
}

export async function POST(req: NextRequest) {
  const { user, service } = await member();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!service) return NextResponse.json({ error: "Support service unavailable" }, { status: 503 });
  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action || "create");

  if (action === "create") {
    const subject = String(body.subject || "").trim().slice(0, 200);
    const message = String(body.message || "").trim().slice(0, 8000);
    if (subject.length < 3 || message.length < 10) {
      return NextResponse.json({ error: "Add a subject and at least 10 characters of detail" }, { status: 400 });
    }
    const { data: ticket, error } = await service
      .from("helpdesk_tickets")
      .insert({
        subject,
        description: "",
        requester_email: user.email,
        requester_user_id: user.id,
        source: "chat",
        status: "open",
        priority: "medium",
        category: String(body.category || "support").slice(0, 50),
      })
      .select("id, ticket_number, subject, status, created_at")
      .single();
    if (error) return NextResponse.json({ error: "Ticket could not be created" }, { status: 500 });
    await Promise.all([
      service.from("helpdesk_messages").insert({
        ticket_id: ticket.id,
        author_type: "user",
        author_email: user.email,
        body: message,
      }),
      service.from("helpdesk_status_history").insert({
        ticket_id: ticket.id,
        to_status: "open",
        actor_user_id: user.id,
        actor_type: "user",
      }),
    ]);
    return NextResponse.json({ ok: true, ticket }, { status: 201 });
  }

  const ticketId = String(body.ticketId || "");
  const { data: ticket } = await service
    .from("helpdesk_tickets")
    .select("id, status")
    .eq("id", ticketId)
    .eq("requester_user_id", user.id)
    .maybeSingle();
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  if (action === "reply") {
    const message = String(body.message || "").trim().slice(0, 8000);
    if (message.length < 1) return NextResponse.json({ error: "Reply is required" }, { status: 400 });
    if (ticket.status === "closed") return NextResponse.json({ error: "Reopen the ticket before replying" }, { status: 409 });
    const { error } = await service.from("helpdesk_messages").insert({
      ticket_id: ticket.id,
      author_type: "user",
      author_email: user.email,
      body: message,
    });
    await service.from("helpdesk_tickets").update({ status: "open", updated_at: new Date().toISOString() }).eq("id", ticket.id);
    return error
      ? NextResponse.json({ error: "Reply could not be sent" }, { status: 500 })
      : NextResponse.json({ ok: true });
  }

  if (action === "close" || action === "reopen") {
    const next = action === "close" ? "closed" : "open";
    if (action === "reopen" && !["closed", "resolved"].includes(ticket.status)) {
      return NextResponse.json({ error: "Only closed or resolved tickets can be reopened" }, { status: 409 });
    }
    await Promise.all([
      service.from("helpdesk_tickets").update({ status: next, updated_at: new Date().toISOString() }).eq("id", ticket.id),
      service.from("helpdesk_status_history").insert({
        ticket_id: ticket.id,
        from_status: ticket.status,
        to_status: next,
        actor_user_id: user.id,
        actor_type: "user",
      }),
    ]);
    return NextResponse.json({ ok: true, status: next });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

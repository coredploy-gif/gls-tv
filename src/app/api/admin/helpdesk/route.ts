import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, isEadminEmail } from "@/lib/eadmin";
import { writeAuditLog } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertAdmin() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user || !isEadminEmail(user.email)) return null;
  return user;
}

export async function GET(req: NextRequest) {
  const user = await assertAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const service = createServiceClient();
  if (!service)
    return NextResponse.json({ error: "No service role" }, { status: 500 });

  const sp = req.nextUrl.searchParams;
  const ticketId = sp.get("ticketId");

  if (ticketId) {
    const [{ data: ticket, error: tErr }, { data: messages, error: mErr }] =
      await Promise.all([
        service.from("helpdesk_tickets").select("*").eq("id", ticketId).single(),
        service
          .from("helpdesk_messages")
          .select("*")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: true }),
      ]);
    if (tErr)
      return NextResponse.json({ error: tErr.message }, { status: 500 });
    if (mErr)
      return NextResponse.json({ error: mErr.message }, { status: 500 });
    return NextResponse.json({ ticket, messages: messages || [] });
  }

  const status = sp.get("status");
  const priority = sp.get("priority");
  const q = (sp.get("q") || "").trim();
  const source = sp.get("source");

  let query = service
    .from("helpdesk_tickets")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (status && status !== "all") query = query.eq("status", status);
  if (priority && priority !== "all") query = query.eq("priority", priority);
  if (source && source !== "all") query = query.eq("source", source);
  if (q) {
    query = query.or(
      `subject.ilike.%${q}%,ticket_number.ilike.%${q}%,requester_email.ilike.%${q}%`,
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tickets: data || [] });
}

export async function POST(req: NextRequest) {
  const service = createServiceClient();
  if (!service)
    return NextResponse.json({ error: "No service role" }, { status: 500 });

  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action || "create");
  const sb = await createClient();
  const {
    data: { user: sessionUser },
  } = await sb.auth.getUser();

  // Public: escalate from live chat → ticket GLS-#### (service role insert)
  if (action === "create_from_chat") {
    const subject = String(body.subject || "Live chat request").slice(0, 200);
    const description = String(body.description || "").slice(0, 8000);
    const email =
      String(body.email || sessionUser?.email || "").slice(0, 200) || null;
    const { data, error } = await service
      .from("helpdesk_tickets")
      .insert({
        subject,
        description,
        requester_email: email,
        requester_user_id: sessionUser?.id || null,
        source: "chat",
        status: "open",
        priority: "medium",
        category: "support",
      })
      .select("*")
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    await service.from("helpdesk_messages").insert({
      ticket_id: data.id,
      author_type: "user",
      author_email: email,
      body: description || subject,
    });

    return NextResponse.json({
      ok: true,
      ticket: data,
      ticketNumber: data.ticket_number,
    });
  }

  const user = await assertAdmin();
  if (!user || !isEadminEmail(user.email))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (action === "update") {
    const id = String(body.id || "");
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of ["status", "priority", "assignee_email", "category", "subject"]) {
      if (body[k] != null) patch[k] = body[k];
    }
    const { data, error } = await service
      .from("helpdesk_tickets")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    await writeAuditLog(service, {
      actorEmail: user.email,
      actorUserId: user.id,
      action: "helpdesk_update",
      entityType: "helpdesk_ticket",
      entityId: id,
      summary: `Updated ${data.ticket_number}`,
      meta: patch,
    });
    return NextResponse.json({ ticket: data });
  }

  if (action === "reply") {
    const id = String(body.id || body.ticketId || "");
    const message = String(body.body || body.message || "").trim();
    if (!id || !message)
      return NextResponse.json(
        { error: "ticket id and message required" },
        { status: 400 },
      );

    const { data: ticket, error: tErr } = await service
      .from("helpdesk_tickets")
      .select("*")
      .eq("id", id)
      .single();
    if (tErr || !ticket)
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    const { data: msg, error: mErr } = await service
      .from("helpdesk_messages")
      .insert({
        ticket_id: id,
        author_type: "agent",
        author_email: user.email,
        body: message.slice(0, 8000),
      })
      .select("*")
      .single();
    if (mErr)
      return NextResponse.json({ error: mErr.message }, { status: 500 });

    const nextStatus =
      body.status != null
        ? String(body.status)
        : ticket.status === "open"
          ? "in_progress"
          : ticket.status === "waiting"
            ? "in_progress"
            : ticket.status;

    await service
      .from("helpdesk_tickets")
      .update({
        status: nextStatus,
        assignee_email: user.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (ticket.requester_user_id) {
      await service.from("user_reminders").insert({
        user_id: ticket.requester_user_id,
        kind: "ticket_reply",
        title: `Support replied · ${ticket.ticket_number}`,
        body: message.slice(0, 280),
        href: "/pricing",
        severity: "info",
        dedupe_key: `ticket-reply-${msg.id}`,
        created_by: user.email,
        meta: { ticketId: id, ticketNumber: ticket.ticket_number },
      });
    }

    await writeAuditLog(service, {
      actorEmail: user.email,
      actorUserId: user.id,
      action: "helpdesk_reply",
      entityType: "helpdesk_ticket",
      entityId: id,
      summary: `Replied on ${ticket.ticket_number}`,
    });

    return NextResponse.json({ ok: true, message: msg, status: nextStatus });
  }

  if (action === "create") {
    const { data, error } = await service
      .from("helpdesk_tickets")
      .insert({
        subject: String(body.subject || "Untitled").slice(0, 200),
        description: String(body.description || ""),
        priority: String(body.priority || "medium"),
        category: String(body.category || "general"),
        requester_email: String(body.requester_email || user.email || ""),
        source: "manual",
        status: "open",
        assignee_email: user.email,
      })
      .select("*")
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    const desc = String(body.description || "").trim();
    if (desc) {
      await service.from("helpdesk_messages").insert({
        ticket_id: data.id,
        author_type: "agent",
        author_email: user.email,
        body: desc,
      });
    }

    await writeAuditLog(service, {
      actorEmail: user.email,
      actorUserId: user.id,
      action: "helpdesk_create",
      entityType: "helpdesk_ticket",
      entityId: data.id,
      summary: `Created ${data.ticket_number}`,
    });
    return NextResponse.json({ ticket: data });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

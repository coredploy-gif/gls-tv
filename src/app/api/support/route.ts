import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/eadmin";
import {
  ESCALATION_ACK,
  ESCALATION_PROMPT,
  NO_KB_MATCH,
  formatKbReply,
  recentHasEscalationPrompt,
  searchKnowledgeBase,
  userWantsAgent,
} from "@/lib/support/kb-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function member() {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  return { user, service: createServiceClient() };
}

async function loadTicket(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  ticketId: string,
  userId: string,
) {
  const { data: ticket } = await service
    .from("helpdesk_tickets")
    .select("id, ticket_number, subject, status, priority, category, created_at, updated_at, escalated_at")
    .eq("id", ticketId)
    .eq("requester_user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  return ticket;
}

async function loadMessages(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  ticketId: string,
) {
  const { data: messages } = await service
    .from("helpdesk_messages")
    .select("id, author_type, body, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at");
  return messages || [];
}

async function respondWithKbAndEscalation(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  ticketId: string,
  userMessage: string,
  messages: { author_type: string; body: string }[],
  escalated: boolean,
) {
  const inserts: { ticket_id: string; author_type: string; body: string }[] = [];

  if (userWantsAgent(userMessage)) {
    if (!escalated) {
      await service
        .from("helpdesk_tickets")
        .update({
          status: "waiting",
          escalated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticketId);
      inserts.push({ ticket_id: ticketId, author_type: "system", body: ESCALATION_ACK });
    }
    return inserts;
  }

  const hits = await searchKnowledgeBase(service, userMessage, 1);
  const best = hits[0];

  if (best && best.score >= 3) {
    inserts.push({
      ticket_id: ticketId,
      author_type: "system",
      body: formatKbReply(best),
    });
  } else {
    inserts.push({ ticket_id: ticketId, author_type: "system", body: NO_KB_MATCH });
  }

  if (!escalated && !recentHasEscalationPrompt(messages)) {
    inserts.push({ ticket_id: ticketId, author_type: "system", body: ESCALATION_PROMPT });
  }

  return inserts;
}

export async function GET(req: NextRequest) {
  const { user, service } = await member();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!service) return NextResponse.json({ error: "Support service unavailable" }, { status: 503 });

  const ticketId = req.nextUrl.searchParams.get("ticket");
  const since = req.nextUrl.searchParams.get("since");

  if (!ticketId) {
    const { data, error } = await service
      .from("helpdesk_tickets")
      .select("id, ticket_number, subject, status, priority, category, created_at, updated_at, escalated_at")
      .eq("requester_user_id", user.id)
      .is("deleted_at", null)
      .eq("source", "chat")
      .order("updated_at", { ascending: false })
      .limit(100);
    return error
      ? NextResponse.json({ error: "Tickets could not be loaded" }, { status: 500 })
      : NextResponse.json({ tickets: data || [] });
  }

  const ticket = await loadTicket(service, ticketId, user.id);
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  let msgQuery = service
    .from("helpdesk_messages")
    .select("id, author_type, body, created_at")
    .eq("ticket_id", ticket.id)
    .order("created_at");

  if (since) {
    msgQuery = msgQuery.gt("created_at", since);
  }

  const [{ data: messages }, { data: history }] = await Promise.all([
    msgQuery,
    service
      .from("helpdesk_status_history")
      .select("id, from_status, to_status, actor_type, created_at")
      .eq("ticket_id", ticket.id)
      .order("created_at"),
  ]);

  return NextResponse.json({
    ticket,
    messages: messages || [],
    history: history || [],
  });
}

export async function POST(req: NextRequest) {
  const { user, service } = await member();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!service) return NextResponse.json({ error: "Support service unavailable" }, { status: 503 });

  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action || "send");

  if (action === "delete_history") {
    const confirm = String(body.confirm || "");
    if (confirm !== "DELETE") {
      return NextResponse.json({ error: "Type DELETE to confirm clearing chat history" }, { status: 400 });
    }
    const now = new Date().toISOString();
    const { error } = await service
      .from("helpdesk_tickets")
      .update({ deleted_at: now, updated_at: now })
      .eq("requester_user_id", user.id)
      .eq("source", "chat")
      .is("deleted_at", null);
    return error
      ? NextResponse.json({ error: "Chat history could not be cleared" }, { status: 500 })
      : NextResponse.json({ ok: true });
  }

  if (action === "escalate") {
    const ticketId = String(body.ticketId || "");
    const ticket = await loadTicket(service, ticketId, user.id);
    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    if (ticket.escalated_at) return NextResponse.json({ ok: true, already: true });

    await Promise.all([
      service
        .from("helpdesk_tickets")
        .update({
          status: "waiting",
          escalated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticket.id),
      service.from("helpdesk_messages").insert({
        ticket_id: ticket.id,
        author_type: "system",
        body: ESCALATION_ACK,
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  if (action === "send") {
    const message = String(body.message || "").trim().slice(0, 8000);
    if (message.length < 1) return NextResponse.json({ error: "Message is required" }, { status: 400 });

    let ticketId = String(body.ticketId || "");
    let ticket = ticketId ? await loadTicket(service, ticketId, user.id) : null;

    if (!ticket) {
      const subject = message.slice(0, 120) || "Live chat";
      const { data: created, error } = await service
        .from("helpdesk_tickets")
        .insert({
          subject,
          description: "",
          requester_email: user.email,
          requester_user_id: user.id,
          source: "chat",
          status: "open",
          priority: "medium",
          category: "support",
        })
        .select("id, ticket_number, subject, status, priority, category, created_at, updated_at, escalated_at")
        .single();
      if (error || !created) {
        return NextResponse.json({ error: "Chat could not be started" }, { status: 500 });
      }
      ticket = created;
      ticketId = created.id;
      await service.from("helpdesk_status_history").insert({
        ticket_id: created.id,
        to_status: "open",
        actor_user_id: user.id,
        actor_type: "user",
      });
    }

    if (!ticket) {
      return NextResponse.json({ error: "Chat could not be started" }, { status: 500 });
    }

    const activeTicket = ticket;
    if (activeTicket.status === "closed") {
      return NextResponse.json({ error: "This chat is closed. Start a new conversation." }, { status: 409 });
    }

    const priorMessages = await loadMessages(service, activeTicket.id);

    await service.from("helpdesk_messages").insert({
      ticket_id: activeTicket.id,
      author_type: "user",
      author_email: user.email,
      body: message,
    });

    const systemReplies = await respondWithKbAndEscalation(
      service,
      activeTicket.id,
      message,
      priorMessages,
      Boolean(activeTicket.escalated_at),
    );

    if (systemReplies.length) {
      await service.from("helpdesk_messages").insert(systemReplies);
    }

    await service
      .from("helpdesk_tickets")
      .update({
        updated_at: new Date().toISOString(),
        status: activeTicket.escalated_at ? "waiting" : "open",
      })
      .eq("id", activeTicket.id);

    const messages = await loadMessages(service, activeTicket.id);
    const refreshed = await loadTicket(service, activeTicket.id, user.id);

    return NextResponse.json({ ok: true, ticket: refreshed, messages });
  }

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
  const ticket = await loadTicket(service, ticketId, user.id);
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  if (action === "reply") {
    const message = String(body.message || "").trim().slice(0, 8000);
    if (message.length < 1) return NextResponse.json({ error: "Reply is required" }, { status: 400 });
    if (ticket.status === "closed") {
      return NextResponse.json({ error: "Reopen the ticket before replying" }, { status: 409 });
    }

    const priorMessages = await loadMessages(service, ticket.id);
    await service.from("helpdesk_messages").insert({
      ticket_id: ticket.id,
      author_type: "user",
      author_email: user.email,
      body: message,
    });

    const systemReplies = await respondWithKbAndEscalation(
      service,
      ticket.id,
      message,
      priorMessages,
      Boolean(ticket.escalated_at),
    );
    if (systemReplies.length) {
      await service.from("helpdesk_messages").insert(systemReplies);
    }

    await service
      .from("helpdesk_tickets")
      .update({
        status: ticket.escalated_at ? "waiting" : "open",
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);

    return NextResponse.json({ ok: true });
  }

  if (action === "close" || action === "reopen") {
    const next = action === "close" ? "closed" : "open";
    if (action === "reopen" && !["closed", "resolved"].includes(ticket.status)) {
      return NextResponse.json({ error: "Only closed or resolved tickets can be reopened" }, { status: 409 });
    }
    await Promise.all([
      service
        .from("helpdesk_tickets")
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq("id", ticket.id),
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

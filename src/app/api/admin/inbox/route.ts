import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/eadmin";
import { writeAuditLog } from "@/lib/admin/audit";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertAdmin() {
  const access = await getAdminAccess();
  if (!access || !hasAdminPermission(access, "support.write")) return null;
  return access.user;
}

export async function GET(req: NextRequest) {
  const user = await assertAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "No service role" }, { status: 500 });
  }

  const status = req.nextUrl.searchParams.get("status") || "all";
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const id = req.nextUrl.searchParams.get("id");

  if (id) {
    const { data, error } = await service
      .from("contact_enquiries")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
    }
    return NextResponse.json({ enquiry: data });
  }

  let query = service
    .from("contact_enquiries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status && status !== "all") query = query.eq("status", status);
  if (q) {
    query = query.or(
      `email.ilike.%${q}%,name.ilike.%${q}%,phone.ilike.%${q}%,message.ilike.%${q}%`,
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ enquiries: data || [] });
}

export async function POST(req: NextRequest) {
  const user = await assertAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "No service role" }, { status: 500 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action || "update");
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: enquiry, error: findErr } = await service
    .from("contact_enquiries")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (findErr || !enquiry) {
    return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
  }

  if (action === "update") {
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { updated_at: now };
    if (body.status != null) {
      const status = String(body.status);
      if (!["new", "read", "replied", "closed"].includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      patch.status = status;
      if (status === "read") patch.read_at = now;
      if (status === "replied") patch.replied_at = now;
      if (status === "closed") patch.closed_at = now;
    }
    if (body.internal_notes != null) {
      patch.internal_notes = String(body.internal_notes).slice(0, 8000);
    }
    const { data, error } = await service
      .from("contact_enquiries")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await writeAuditLog(service, {
      actorEmail: user.email,
      actorUserId: user.id,
      action: "contact_enquiry_update",
      entityType: "contact_enquiry",
      entityId: id,
      summary: `Updated contact enquiry ${enquiry.email}`,
      meta: patch,
    });
    return NextResponse.json({ enquiry: data });
  }

  if (action === "convert_ticket") {
    if (enquiry.converted_ticket_id) {
      return NextResponse.json({
        ok: true,
        ticketId: enquiry.converted_ticket_id,
        already: true,
      });
    }
    const subject = `[Contact] ${String(enquiry.name || "Guest").slice(0, 80)} — ${String(enquiry.email).slice(0, 80)}`;
    const description = [
      `Public contact from /auth`,
      `Name: ${enquiry.name || "—"}`,
      `Email: ${enquiry.email}`,
      `Phone: ${enquiry.phone || "—"}`,
      "",
      enquiry.message,
    ].join("\n");

    const { data: ticket, error: tErr } = await service
      .from("helpdesk_tickets")
      .insert({
        subject: subject.slice(0, 200),
        description,
        requester_email: enquiry.email,
        source: "contact",
        status: "open",
        priority: "medium",
        category: "support",
        assignee_email: user.email,
      })
      .select("*")
      .single();
    if (tErr || !ticket) {
      return NextResponse.json(
        { error: tErr?.message || "Ticket could not be created" },
        { status: 500 },
      );
    }

    await service.from("helpdesk_messages").insert({
      ticket_id: ticket.id,
      author_type: "user",
      author_email: enquiry.email,
      body: enquiry.message,
    });

    const now = new Date().toISOString();
    await service
      .from("contact_enquiries")
      .update({
        converted_ticket_id: ticket.id,
        status: "replied",
        replied_at: now,
        updated_at: now,
        internal_notes: `${enquiry.internal_notes || ""}\nConverted to ${ticket.ticket_number}`.trim(),
      })
      .eq("id", id);

    await writeAuditLog(service, {
      actorEmail: user.email,
      actorUserId: user.id,
      action: "contact_convert_ticket",
      entityType: "contact_enquiry",
      entityId: id,
      summary: `Converted enquiry to ${ticket.ticket_number}`,
    });

    return NextResponse.json({ ok: true, ticket });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/eadmin";
import { getAdminAccess } from "@/lib/admin/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertAdmin() {
  const access = await getAdminAccess();
  return access?.user || null;
}

export async function GET(req: NextRequest) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  if (!service)
    return NextResponse.json({ error: "No service role" }, { status: 500 });

  const source = req.nextUrl.searchParams.get("source") || "all";
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.min(
    200,
    Math.max(20, Number(req.nextUrl.searchParams.get("limit") || 80) || 80),
  );

  const items: Array<{
    id: string;
    source: "audit" | "billing";
    at: string;
    action: string;
    summary: string | null;
    actor: string | null;
    entityType: string | null;
    entityId: string | null;
    amountZar: number | null;
    userId: string | null;
  }> = [];

  if (source === "all" || source === "audit") {
    const { data } = await service
      .from("admin_audit_log")
      .select(
        "id, actor_email, action, summary, entity_type, entity_id, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    for (const row of data || []) {
      items.push({
        id: `a-${row.id}`,
        source: "audit",
        at: row.created_at,
        action: row.action,
        summary: row.summary,
        actor: row.actor_email,
        entityType: row.entity_type,
        entityId: row.entity_id,
        amountZar: null,
        userId: null,
      });
    }
  }

  if (source === "all" || source === "billing") {
    const { data } = await service
      .from("billing_events")
      .select(
        "id, event_type, amount_zar_cents, created_at, user_id, payload",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    for (const row of data || []) {
      const payload = (row.payload || {}) as Record<string, unknown>;
      items.push({
        id: `b-${row.id}`,
        source: "billing",
        at: row.created_at,
        action: row.event_type,
        summary:
          typeof payload.by === "string"
            ? `by ${payload.by}`
            : row.event_type.replace(/_/g, " "),
        actor: typeof payload.by === "string" ? payload.by : null,
        entityType: "billing",
        entityId: row.user_id,
        amountZar:
          row.amount_zar_cents != null ? row.amount_zar_cents / 100 : null,
        userId: row.user_id,
      });
    }
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  let filtered = items;
  if (q) {
    filtered = items.filter(
      (i) =>
        i.action.toLowerCase().includes(q) ||
        (i.summary || "").toLowerCase().includes(q) ||
        (i.actor || "").toLowerCase().includes(q) ||
        (i.entityId || "").toLowerCase().includes(q),
    );
  }

  return NextResponse.json({
    items: filtered.slice(0, limit),
    counts: {
      audit: items.filter((i) => i.source === "audit").length,
      billing: items.filter((i) => i.source === "billing").length,
    },
  });
}

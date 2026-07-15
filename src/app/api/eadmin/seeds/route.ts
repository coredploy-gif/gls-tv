import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createServiceClient,
  isEadminEmail,
  isHttpUrl,
  normalizeSlug,
  type StreamSeedRow,
} from "@/lib/eadmin";
import { writeAuditLog } from "@/lib/admin/audit";
import { validatePublicUrl } from "@/lib/secure-url";
import { isAllowedMediaHost } from "@/lib/media-hosts";

async function requireEadmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isEadminEmail(user.email)) {
    return { user: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const service = createServiceClient();
  if (!service) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY missing on server" },
        { status: 500 },
      ),
    };
  }
  return { user, service, error: null as null };
}

export async function GET() {
  const gate = await requireEadmin();
  if (gate.error) return gate.error;

  const { data, error } = await gate.service!
    .from("stream_seeds")
    .select(
      "slug, title, url, categories, countries, poster, backdrop, is_active, updated_at",
    )
    .order("slug", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ seeds: (data ?? []) as StreamSeedRow[] });
}

type UpsertBody = {
  slug?: string;
  title?: string;
  url?: string;
  categories?: string[];
  countries?: string[];
  poster?: string;
  backdrop?: string;
  is_active?: boolean;
};

export async function PUT(req: Request) {
  const gate = await requireEadmin();
  if (gate.error) return gate.error;

  let body: UpsertBody | UpsertBody[];
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rows = Array.isArray(body) ? body : [body];
  const payload = [];

  for (const row of rows) {
    const slug = normalizeSlug(row.slug || "");
    const title = (row.title || slug || "").trim();
    const url = (row.url || "").trim();
    if (!slug || !title) {
      return NextResponse.json(
        { error: "Each seed needs slug + title" },
        { status: 400 },
      );
    }
    if (url && !isHttpUrl(url)) {
      return NextResponse.json(
        { error: `Bad URL for ${slug}` },
        { status: 400 },
      );
    }
    if (url) {
      try {
        await validatePublicUrl(url, isAllowedMediaHost);
      } catch {
        return NextResponse.json(
          { error: `Stream host is not approved for ${slug}` },
          { status: 400 },
        );
      }
    }
    payload.push({
      slug,
      title,
      url,
      categories: row.categories?.length ? row.categories : ["Sports", "UserSeed"],
      countries: row.countries?.length ? row.countries : ["world"],
      poster: row.poster || "",
      backdrop: row.backdrop || "",
      is_active: row.is_active !== false,
      updated_by: gate.user!.id,
      updated_at: new Date().toISOString(),
    });
  }

  const { data, error } = await gate.service!
    .from("stream_seeds")
    .upsert(payload, { onConflict: "slug" })
    .select(
      "slug, title, url, categories, countries, poster, backdrop, is_active, updated_at",
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await writeAuditLog(gate.service!, {
    actorEmail: gate.user!.email,
    actorUserId: gate.user!.id,
    action: "stream_seed.upsert",
    entityType: "stream_seed",
    summary: `Updated ${payload.length} approved stream seed(s)`,
    meta: { slugs: payload.map((row) => row.slug) },
  });

  return NextResponse.json({ seeds: data ?? [] });
}

export async function DELETE(req: Request) {
  const gate = await requireEadmin();
  if (gate.error) return gate.error;

  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const { error } = await gate.service!
    .from("stream_seeds")
    .delete()
    .eq("slug", normalizeSlug(slug));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await writeAuditLog(gate.service!, {
    actorEmail: gate.user!.email,
    actorUserId: gate.user!.id,
    action: "stream_seed.delete",
    entityType: "stream_seed",
    entityId: normalizeSlug(slug),
    summary: "Deleted approved stream seed",
  });

  return NextResponse.json({ ok: true });
}

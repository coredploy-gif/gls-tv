import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, isEadminEmail } from "@/lib/eadmin";
import {
  downloadAndExtract,
  upsertMatchesToSeeds,
  type SyncMode,
} from "@/lib/iptv-org-sync";
import { IPTV_ORG_TARGETS } from "@/lib/iptv-org-targets";

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

/**
 * Cherry-pick allowlisted channels from iptv-org into stream_seeds.
 * Does not import the full 13k list into the app.
 */
export async function POST(req: Request) {
  const gate = await requireEadmin();
  if (gate.error) return gate.error;

  let body: {
    mode?: SyncMode;
    replaceExisting?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body OK */
  }

  const mode: SyncMode = body.mode === "index" ? "index" : "smart";
  const replaceExisting = body.replaceExisting !== false;

  try {
    const { matches, sources } = await downloadAndExtract(mode);
    const result = await upsertMatchesToSeeds(gate.service!, matches, {
      replaceExisting,
      updatedBy: gate.user!.id,
    });

    return NextResponse.json({
      ok: true,
      mode,
      sources,
      targets: IPTV_ORG_TARGETS.map((t) => t.slug),
      ...result,
      preview: result.matches.map((m) => ({
        slug: m.slug,
        title: m.title,
        playlistTitle: m.playlistTitle,
        url: m.url,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const gate = await requireEadmin();
  if (gate.error) return gate.error;

  return NextResponse.json({
    targets: IPTV_ORG_TARGETS.map((t) => ({
      slug: t.slug,
      title: t.title,
    })),
    modes: ["smart", "index"],
  });
}

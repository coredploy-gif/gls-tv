import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ playlists: [], channels: [] });
  }

  const { data: playlists, error: pErr } = await supabase
    .from("user_playlists")
    .select(
      "id, user_id, name, source_url, channel_count, status, error_message, last_synced_at, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  const { data: channels, error: cErr } = await supabase
    .from("user_playlist_channels")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })
    .limit(2000);

  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }

  return NextResponse.json({
    playlists: playlists ?? [],
    channels: channels ?? [],
  });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing playlist id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_playlists")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

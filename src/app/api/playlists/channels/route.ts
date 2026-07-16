import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAccountEntitlement } from "@/lib/membership/account";

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entitlement = await getAccountEntitlement(user.id, user.email);
  if (!entitlement.allowed) {
    return NextResponse.json(
      { error: "An active membership is required to rename channels." },
      { status: 403 },
    );
  }

  let body: { id?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = (body.title || "").trim().slice(0, 200);
  if (!body.id || !title) {
    return NextResponse.json(
      { error: "A valid channel id and title are required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("user_playlist_channels")
    .update({ title })
    .eq("id", body.id)
    .eq("user_id", user.id)
    .select("id, title, slug, playlist_id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Channel could not be renamed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ channel: data });
}

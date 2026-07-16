import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isKnownGameId } from "@/lib/games";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gameId = req.nextUrl.searchParams.get("gameId") || "";
  if (!isKnownGameId(gameId)) {
    return NextResponse.json({ error: "Unknown game" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("game_scores")
    .select("id, display_name, score, created_at, user_id")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: mine } = await supabase
    .from("game_scores")
    .select("score")
    .eq("game_id", gameId)
    .eq("user_id", user.id)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    leaderboard: data || [],
    myBest: mine?.score ?? 0,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    gameId?: string;
    score?: number;
  } | null;
  const gameId = String(body?.gameId || "");
  const score = Number(body?.score);
  if (!isKnownGameId(gameId)) {
    return NextResponse.json({ error: "Unknown game" }, { status: 400 });
  }
  if (!Number.isFinite(score) || score < 0 || score > 100_000_000) {
    return NextResponse.json({ error: "Invalid score" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    profile?.display_name?.trim() ||
    user.email?.split("@")[0] ||
    "Player";

  const { data: best } = await supabase
    .from("game_scores")
    .select("score")
    .eq("game_id", gameId)
    .eq("user_id", user.id)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();

  if ((best?.score || 0) >= score) {
    return NextResponse.json({
      ok: true,
      saved: false,
      myBest: best?.score || 0,
    });
  }

  const { error } = await supabase.from("game_scores").insert({
    game_id: gameId,
    user_id: user.id,
    display_name: displayName.slice(0, 48),
    score: Math.floor(score),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, saved: true, myBest: Math.floor(score) });
}

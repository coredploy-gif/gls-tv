"use client";

import { useEffect, useRef, useState } from "react";
import { GameVirtualPad } from "@/components/GameVirtualPad";
import type { GamePadScheme } from "@/lib/games";

type LeaderRow = {
  id: string;
  display_name: string;
  score: number;
  user_id: string;
};

export function GamePlayer({
  gameId,
  src,
  title,
  howToPlay,
  padScheme = "none",
  accent = "#e50914",
}: {
  gameId: string;
  src: string;
  title: string;
  howToPlay?: string[];
  padScheme?: GamePadScheme;
  accent?: string;
}) {
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [myBest, setMyBest] = useState(0);
  const [status, setStatus] = useState("Play to climb the board");
  const [signedIn, setSignedIn] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [nativeFs, setNativeFs] = useState(false);
  const [showPadDesktop, setShowPadDesktop] = useState(false);
  const saving = useRef(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wantNativeFs = useRef(false);

  async function refresh() {
    const res = await fetch(`/api/games/scores?gameId=${encodeURIComponent(gameId)}`, {
      cache: "no-store",
    });
    if (res.status === 401) {
      setSignedIn(false);
      setStatus("Sign in to save high scores");
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    setLeaderboard(data.leaderboard || []);
    setMyBest(data.myBest || 0);
    setSignedIn(true);
  }

  useEffect(() => {
    void refresh();
  }, [gameId]);

  useEffect(() => {
    async function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || data.type !== "gls-game-score" || data.gameId !== gameId) return;
      const score = Number(data.score);
      if (!Number.isFinite(score) || score <= 0) return;
      if (!data.force && score <= myBest) return;
      if (saving.current) return;
      saving.current = true;
      try {
        const res = await fetch("/api/games/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId, score }),
        });
        if (res.status === 401) {
          setSignedIn(false);
          setStatus("Sign in to save high scores");
          return;
        }
        const json = await res.json();
        if (json.saved) {
          setStatus(`New best · ${json.myBest}`);
          setMyBest(json.myBest);
          await refresh();
        } else if (json.myBest != null) {
          setMyBest(json.myBest);
        }
      } finally {
        saving.current = false;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [gameId, myBest]);

  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        void exitExpand();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded || !wantNativeFs.current) return;
    wantNativeFs.current = false;
    const target = shellRef.current;
    if (!target?.requestFullscreen) return;
    void target.requestFullscreen().then(
      () => setNativeFs(true),
      () => undefined,
    );
  }, [expanded]);

  useEffect(() => {
    function onFsChange() {
      const el = document.fullscreenElement;
      setNativeFs(!!el && el === shellRef.current);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function enterExpand() {
    wantNativeFs.current = true;
    setSideOpen(false);
    setExpanded(true);
  }

  async function exitExpand() {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* ignore */
      }
    }
    setNativeFs(false);
    setExpanded(false);
    setSideOpen(false);
  }

  async function toggleNativeFullscreen() {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* ignore */
      }
      setNativeFs(false);
      return;
    }
    const target = shellRef.current;
    if (!target?.requestFullscreen) return;
    try {
      await target.requestFullscreen();
      setNativeFs(true);
    } catch {
      /* ignore */
    }
  }

  const showPad = padScheme !== "none";

  const leaderboardPanel = (
    <aside className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
        Leaderboard
      </p>
      <p className="mt-2 text-sm text-white/70">{status}</p>
      <p className="mt-1 text-sm text-emerald-300/90">
        Your best: {signedIn ? myBest : "—"}
      </p>
      {!signedIn && (
        <a
          href="/auth"
          className="mt-3 inline-flex rounded-full bg-gls-red px-4 py-2 text-sm font-bold text-white"
        >
          Sign in
        </a>
      )}
      <ol className="mt-4 space-y-2">
        {leaderboard.length === 0 && (
          <li className="text-sm text-white/45">No scores yet — be first.</li>
        )}
        {leaderboard.map((row, i) => (
          <li
            key={row.id}
            className="flex items-center justify-between gap-3 border-b border-white/5 py-2 text-sm"
          >
            <span className="truncate text-white/85">
              <span className="mr-2 text-white/40">{i + 1}.</span>
              {row.display_name}
            </span>
            <span className="font-semibold tabular-nums text-white">{row.score}</span>
          </li>
        ))}
      </ol>
    </aside>
  );

  const howToPanel =
    howToPlay && howToPlay.length > 0 ? (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
          How to play
        </p>
        <ul className="mt-3 space-y-2">
          {howToPlay.map((tip) => (
            <li key={tip} className="flex gap-2.5 text-sm leading-relaxed text-white/70">
              <span
                aria-hidden
                className="mt-2 h-1 w-1 shrink-0 rounded-full"
                style={{ background: accent }}
              />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {!expanded ? (
        <button
          type="button"
          onClick={enterExpand}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/75 px-3 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition hover:border-white/40 hover:bg-black/90 sm:px-4"
        >
          Expand play
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void exitExpand()}
            className="inline-flex items-center gap-2 rounded-full bg-gls-red px-4 py-2 text-sm font-bold text-white"
          >
            Exit
          </button>
          <button
            type="button"
            onClick={() => void toggleNativeFullscreen()}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-2 text-sm font-semibold text-white"
          >
            {nativeFs ? "Exit FS" : "Fullscreen"}
          </button>
          <button
            type="button"
            onClick={() => setSideOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-2 text-sm font-semibold text-white"
            aria-expanded={sideOpen}
          >
            {sideOpen ? "Hide info" : "Scores"}
          </button>
          {showPad && (
            <button
              type="button"
              onClick={() => setShowPadDesktop((v) => !v)}
              className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-2 text-sm font-semibold text-white lg:inline-flex"
            >
              {showPadDesktop ? "Hide pad" : "Show pad"}
            </button>
          )}
        </>
      )}
    </div>
  );

  const pad = showPad ? (
    <GameVirtualPad
      scheme={padScheme}
      iframeRef={iframeRef}
      accent={accent}
      forceDesktop={showPadDesktop}
      expanded={expanded}
    />
  ) : null;

  const iframe = (
    <iframe
      ref={iframeRef}
      title={title}
      src={src}
      allow="fullscreen"
      className="h-full min-h-0 w-full flex-1 bg-black"
    />
  );

  if (expanded) {
    return (
      <div
        ref={shellRef}
        className="fixed inset-0 z-[100] flex flex-col bg-gls-black"
        role="dialog"
        aria-modal="true"
        aria-label={`${title} — expanded play`}
      >
        {/* Top chrome — always visible in FS */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/90 px-3 py-2 backdrop-blur-md safe-area-pt">
          <p className="min-w-0 truncate text-sm font-bold text-white">{title}</p>
          {toolbar}
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Stage */}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-black">
            <div className="min-h-0 flex-1">{iframe}</div>
            {/* Pad docked under stage — visible on phone in expanded/FS */}
            {showPad && (
              <div className="relative z-10 shrink-0 border-t border-white/10 bg-black/95 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {pad}
              </div>
            )}
          </div>

          {sideOpen && (
            <div className="absolute inset-x-0 bottom-0 top-auto z-20 max-h-[45%] overflow-y-auto border-t border-white/10 bg-gls-black/95 p-3 sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:max-h-none sm:w-[300px] sm:border-l sm:border-t-0">
              <div className="space-y-3">
                {leaderboardPanel}
                {howToPanel}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={shellRef} className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl shadow-black/50">
            <div className="relative flex justify-end border-b border-white/10 bg-black/80 px-3 py-2">
              {toolbar}
            </div>
            <div className="aspect-[4/5] w-full sm:aspect-[5/4]">{iframe}</div>
            {showPad && (
              <div className="border-t border-white/10 bg-black/90 px-3 py-3">
                {pad}
              </div>
            )}
          </div>
          {howToPanel}
        </div>
        {leaderboardPanel}
      </div>
    </div>
  );
}

"use client";

import { RefreshCw, Trophy } from "lucide-react";
import Cookies from "js-cookie";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { ScoreEntry } from "@/lib/leaderboard";

const ZONE_ACCENTS = ["#f87171", "#c084fc", "#38bdf8", "#fb923c", "#a78bfa"];

type Props = {
  /** Bump to refetch — e.g. after a run just posted its score. */
  refreshKey?: number;
  /** Emphasize this run's row (the run that just ended). */
  highlightRunId?: string;
};

/**
 * Top-10 leaderboard. Fetches from /api/score and lets the pilot set a
 * callsign (persisted in a cookie, used when the run auto-posts on death).
 */
export default function Leaderboard({ refreshKey = 0, highlightRunId }: Props) {
  const [scores, setScores] = useState<ScoreEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState(() => Cookies.get("pilotName") || "Pilot");

  // Pure fetch — returns the list or null on failure; state is set only by
  // callers (effect callback / button handler), never synchronously in an
  // effect body.
  const fetchScores = useCallback(async (): Promise<ScoreEntry[] | null> => {
    try {
      const res = await fetch("/api/score", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { scores?: ScoreEntry[] };
      return data.scores ?? [];
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchScores().then((scores) => {
      if (cancelled) return;
      if (scores === null) setFailed(true);
      else {
        setScores(scores);
        setFailed(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fetchScores, refreshKey]);

  const refresh = () => {
    fetchScores().then((scores) => {
      if (scores === null) setFailed(true);
      else {
        setScores(scores);
        setFailed(false);
      }
    });
  };

  const commitName = (raw: string) => {
    const clean = raw
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, 16);
    const final = clean || "Pilot";
    setName(final);
    Cookies.set("pilotName", final, { expires: 365 });
  };

  return (
    <div className="w-full max-w-sm rounded-xl border border-white/10 bg-black/40 px-4 py-3">
      <div className="mb-3 flex items-center justify-center gap-2 border-b border-white/10 pb-3">
        <Image
          src="/Images/meteordash_old.png"
          width={30}
          height={30}
          alt=""
          style={{ height: "auto" }}
        />
        <span className="text-base font-extrabold tracking-wide text-red-600">
          Meteor Dash
        </span>
      </div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-amber-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-white/70">
            Leaderboard
          </span>
        </div>
        <button
          type="button"
          onClick={refresh}
          aria-label="Refresh leaderboard"
          className="text-white/40 transition-colors hover:text-white"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <label
          htmlFor="callsign"
          className="text-[10px] font-bold uppercase tracking-wide text-white/50"
        >
          Callsign
        </label>
        <input
          id="callsign"
          value={name}
          maxLength={16}
          onChange={(e) => setName(e.target.value)}
          onBlur={(e) => commitName(e.target.value)}
          className="w-32 rounded border border-white/15 bg-white/5 px-2 py-1 text-xs font-bold text-white outline-none focus:border-amber-400/60"
        />
      </div>

      {failed ? (
        <div className="text-[11px] font-semibold text-white/50">
          Leaderboard offline — your score is saved locally.
        </div>
      ) : scores === null ? (
        <div className="text-[11px] font-semibold text-white/50">
          Loading…
        </div>
      ) : scores.length === 0 ? (
        <div className="text-[11px] font-semibold text-white/50">
          No runs yet — be the first!
        </div>
      ) : (
        <ol className="flex flex-col gap-1">
          {scores.map((s, i) => {
            const mine = highlightRunId !== undefined && s.runId === highlightRunId;
            const rankColor =
              i === 0
                ? "text-amber-400"
                : i === 1
                  ? "text-slate-300"
                  : i === 2
                    ? "text-orange-400"
                    : "text-white/40";
            return (
              <li
                key={s.runId}
                className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1 ${mine
                    ? "border-amber-400/50 bg-amber-400/10"
                    : "border-transparent bg-white/5"
                  }`}
              >
                <span className={`w-5 shrink-0 text-xs font-extrabold ${rankColor}`}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-bold text-white/90">
                  {s.name}
                  {mine && <span className="ml-1 text-[9px] font-bold text-amber-400">YOU</span>}
                </span>
                <span
                  className="shrink-0 rounded px-1 py-px text-[9px] font-extrabold text-white/70"
                  style={{
                    backgroundColor: `${ZONE_ACCENTS[(s.zone - 1) % ZONE_ACCENTS.length]}26`,
                  }}
                >
                  Z{s.zone}
                </span>
                <span className="shrink-0 text-xs font-extrabold tabular-nums text-white">
                  {s.score.toLocaleString()}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

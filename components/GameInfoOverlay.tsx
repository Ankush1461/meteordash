import {
  ArrowLeft,
  Coffee,
  Hand,
  Home,
  Loader2,
  Lock,
  Moon,
  RotateCcw,
  StopCircle,
  Trophy,
  UnfoldHorizontal,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import Cookies from "js-cookie";
import SocialMediaLinks from "./SocialLinks";
import Image from "next/image";
import { RocketSprite } from "./RocketComponent";
import Leaderboard from "./Leaderboard";
import ConfettiBurst from "./ConfettiBurst";
import LandingPage from "./LandingPage";
import { BadgeIcon, BADGES, type BadgeId } from "@/utils/badges";
import { type RocketSkin, type SkinId } from "@/utils/skins";
import {
  UPI_AMOUNT,
  UPI_NOTE,
  UPI_PAYEE_NAME,
  UPI_PRESETS,
} from "@/lib/game/support";

export type GameState =
  | "landing"
  | "idle"
  | "tutorial"
  | "countdown"
  | "playing"
  | "paused"
  | "gameover";

export type ZoneVisit = {
  zone: number;
  name: string;
  cleared: boolean;
  distanceAt: number;
  bestCombo: number;
};

export type RunStats = {
  score: number;
  maxCombo: number;
  grazes: number;
  powerUps: number;
  dashes: number;
  shields: number;
  bosses: number;
  /** Zones visited this run, oldest first — the "journey" story. */
  journey: ZoneVisit[];
  /** Mission brief of the zone where the run ended (not yet cleared). */
  finalObjective?: string;
};

// Zone accent colors, matching ZONE_THEMES in app/page.tsx, for the
// journey log's colored dots.
const ZONE_ACCENTS = ["#f87171", "#c084fc", "#38bdf8", "#fb923c", "#a78bfa"];

type Props = {
  isLoading: boolean;
  isCameraError: boolean;
  cameraError: string | null;
  /** True while the room is too dark for reliable hand tracking. */
  lowLight: boolean;
  onRetry: () => void;
  gameState: GameState;
  onStartGame: () => void;
  onStopGame: () => void;
  onGoToHome: () => void;
  countdown: number;
  isColliding: boolean;
  distance: number;
  livesRemainingState: number;
  /** Banked reserve lives (hearts grabbed at max) shown dimmed in the HUD. */
  reserveLives: number;
  highScore: number;
  combo: number;
  /** Snapshot of the finished run's stats, shown on the game-over screen. */
  runStats: RunStats | null;
  badges: { id: BadgeId; unlocked: boolean }[];
  /** Selected rocket skin (drives the in-game rocket + lives HUD colors). */
  skin: RocketSkin;
  skins: RocketSkin[];
  unlockedSkinIds: SkinId[];
  onSelectSkin: (id: SkinId) => void;
  /** Bumped after a run posts, so the leaderboard refetches. */
  leaderboardRefresh: number;
  /** runId of the just-finished run — highlighted on the game-over board. */
  postedRunId: string | null;
  /** Non-null while a top-10 run awaits the player's callsign. */
  pendingQualify: { rank: number } | null;
  onConfirmName: (name: string) => void;
  onDismissName: () => void;
  /** Random seed for a confetti burst; 0 = none (set on landed runs). */
  confettiSeed: number;
  /** Pinch-to-fire shot meter (0–100), filled by grazes and dashes. */
  shootMeter: number;
  /** Bolts currently in flight (0–3) — the ammo pips. */
  boltCount: number;
  /** Floating leaderboard window open state (owned by the page). */
  leaderboardOpen: boolean;
  onOpenLeaderboard: () => void;
  onCloseLeaderboard: () => void;
};

/**
 * Callsign prompt shown when a run cracks the top-10. Mounted fresh per
 * prompt (keyed by rank), so it reads the saved callsign at mount time and
 * all its state changes happen in event handlers.
 */
function NamePrompt({
  rank,
  onConfirm,
  onDismiss,
}: {
  rank: number;
  onConfirm: (name: string) => void;
  onDismiss: () => void;
}) {
  const [name, setName] = useState(() => Cookies.get("pilotName") || "");

  // Esc anywhere dismisses (Skip) — the prompt is the only thing on screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-amber-400/40 bg-[#0d1220] px-6 py-6 shadow-[0_0_40px_rgba(251,191,36,0.25)]">
        <Trophy size={32} className="text-amber-400" />
        <div className="text-center text-2xl font-extrabold text-amber-300">
          You made the Top 10!
        </div>
        <div className="text-center text-sm font-semibold text-white/70">
          {`Rank #${rank} — enter your callsign to save your run`}
        </div>
        <input
          autoFocus
          value={name}
          maxLength={16}
          placeholder="Callsign"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm(name);
          }}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-center text-lg font-bold text-white outline-none focus:border-amber-400/60"
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onConfirm(name)}
            className="rounded bg-amber-500 px-5 py-2 text-sm font-extrabold text-black transition-colors hover:bg-amber-400"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded border border-white/20 px-5 py-2 text-sm font-bold text-white/70 transition-colors hover:text-white"
          >
            Skip
          </button>
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
          Enter = save · Esc = skip
        </div>
      </div>
    </div>
  );
}

/**
 * Memoized HUD. It only re-renders when one of the primitive props it
 * actually displays changes (state transitions, distance ticks), instead
 * of re-rendering on every hand-tracking frame.
 */
const GameInfoOverlay = React.memo(function GameInfoOverlay({
  isLoading,
  isCameraError,
  cameraError,
  lowLight,
  onRetry,
  gameState,
  onStartGame,
  onStopGame,
  onGoToHome,
  countdown,
  isColliding,
  distance,
  livesRemainingState,
  reserveLives,
  highScore,
  combo,
  runStats,
  badges,
  skin,
  skins,
  unlockedSkinIds,
  onSelectSkin,
  leaderboardRefresh,
  postedRunId,
  pendingQualify,
  onConfirmName,
  onDismissName,
  confettiSeed,
  shootMeter,
  boltCount,
  leaderboardOpen,
  onOpenLeaderboard,
  onCloseLeaderboard,
}: Props) {
  // The leaderboard lives in a floating translucent window, opened from a
  // button — it stays out of the main column so the idle/game-over screens
  // fit without scrolling. The UPI support QR uses the same pattern.
  const [supportOpen, setSupportOpen] = useState(false);
  // Tip selection: a preset amount, each with its own static build-time QR.
  const [tip, setTip] = useState(UPI_AMOUNT);
  // Low-light warning is dismissible, but re-arms itself when the room
  // brightens back up and then goes dark again (render-phase adjustment,
  // the same pattern as the support popup below).
  const [lowLightDismissed, setLowLightDismissed] = useState(false);
  if (!lowLight && lowLightDismissed) {
    setLowLightDismissed(false);
  }
  const closeSupport = () => setSupportOpen(false);

  // Esc closes the floating leaderboard window.
  useEffect(() => {
    if (!leaderboardOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseLeaderboard();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leaderboardOpen, onCloseLeaderboard]);

  // Esc closes the support popup, and starting a run closes it too so the
  // payment screen never lingers over gameplay.
  useEffect(() => {
    if (!supportOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSupport();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [supportOpen]);

  // Leaving the menu screens (a run starting) closes the support popup —
  // done as a render-phase adjustment.
  if (
    supportOpen &&
    gameState !== "landing" &&
    gameState !== "idle" &&
    gameState !== "gameover"
  ) {
    setSupportOpen(false);
  }

  const lives = [];
  for (let i = 0; i < livesRemainingState; i++) {
    lives.push(<RocketSprite key={i} skin={skin} size={18} />);
  }
  // Reserve lives render dimmed after the active ones — they absorb a hit
  // before an active life is spent, so they read as "banked".
  const reserves = [];
  for (let i = 0; i < reserveLives; i++) {
    reserves.push(<RocketSprite key={`res-${i}`} skin={skin} size={18} />);
  }

  return (
    <div
      className={`absolute z-30 h-screen w-screen flex items-center justify-center ${
        isColliding ? "border-[18px] border-red-600" : ""
      }`}
    >
      {lowLight && !lowLightDismissed && (
        <div className="fixed left-1/2 top-16 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-amber-400/40 bg-[#0d1220]/95 px-3 py-1.5 text-[11px] font-bold text-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.2)] backdrop-blur">
          <Moon size={13} className="shrink-0" />
          <span className="whitespace-nowrap">
            Room too dark — hand tracking may be unreliable
          </span>
          <button
            type="button"
            onClick={() => setLowLightDismissed(true)}
            aria-label="Dismiss low-light warning"
            className="ml-1 rounded p-0.5 text-amber-300/70 transition-colors hover:text-amber-200"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center flex-col gap-8 rounded-3xl border border-white/10 bg-black/60 p-10 shadow-[0_0_40px_rgba(0,0,0,0.8)] backdrop-blur-md">
          <div className="text-2xl font-bold text-center">
            Initializing{" "}
            <span className="text-3xl text-red-600 font-extrabold block mt-1">
              Meteor Dash
            </span>
          </div>
          <Loader2 size={64} className="animate-spin text-red-500" />
          <div className="text-xs font-semibold text-white/60">
            Setting up camera & AI vision models...
          </div>
        </div>
      )}

      {!isLoading && isCameraError && (
        <div className="flex items-center justify-center flex-col gap-6 rounded-3xl border border-red-500/30 bg-black/80 p-8 shadow-[0_0_40px_rgba(220,38,38,0.3)] backdrop-blur-md max-w-md text-center">
          <div className="text-3xl font-extrabold text-red-500">
            Camera Unavailable
          </div>
          <div className="text-sm font-medium text-white/80 leading-relaxed">
            {cameraError}
          </div>
          <div className="flex gap-3">
            <button
              className="bg-red-600 hover:bg-red-500 text-white font-bold rounded-full py-2.5 px-6 shadow-[0_0_20px_rgba(220,38,38,0.5)] transition-all"
              onClick={onRetry}
            >
              Try Again
            </button>
            <button
              className="border border-white/20 bg-white/5 hover:bg-white/15 text-white/80 font-bold rounded-full py-2.5 px-5 transition-all"
              onClick={onGoToHome}
            >
              Main Menu
            </button>
          </div>
        </div>
      )}

      {/* 1. HOME LANDING PAGE STATE */}
      {!isLoading && !isCameraError && gameState === "landing" && (
        <LandingPage
          onStartGame={onStartGame}
          onOpenLeaderboard={onOpenLeaderboard}
          onOpenSupport={() => setSupportOpen(true)}
          highScore={highScore}
          skin={skin}
          skins={skins}
          unlockedSkinIds={unlockedSkinIds}
          onSelectSkin={onSelectSkin}
        />
      )}

      {/* 2. START HALT STAGE (IDLE) - Waiting for pilot hands */}
      {!isLoading && !isCameraError && gameState === "idle" && (
        <div
          data-menu-scroll
          className="no-scrollbar flex max-h-[92vh] flex-col items-center justify-between gap-6 overflow-y-auto px-6 py-6 select-none"
        >
          <div className="flex items-center justify-center flex-col gap-2">
            <Image src="/Images/meteordash_old.png" width={80} height={80} alt="Logo" priority style={{ height: "auto" }} />
            <span className="text-3xl text-red-600 font-extrabold">
              Meteor Dash
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="text-2xl animate-pulse font-extrabold text-amber-300 tracking-wide">
              LAUNCH READINESS
            </div>
            <div className="text-sm font-semibold text-white/75">
              Flight system calibrated & standing by
            </div>
          </div>

          {/* Big Visual Dual-Hand Prompt Card */}
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-sky-400/40 bg-gradient-to-b from-sky-950/60 to-black/70 p-6 shadow-[0_0_35px_rgba(56,189,248,0.25)] backdrop-blur-md max-w-md w-full text-center">
            <div className="flex items-center justify-center gap-6 text-sky-400">
              <Hand size={42} className="animate-bounce" />
              <Hand size={42} className="animate-bounce [animation-delay:150ms]" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-lg font-extrabold text-white">
                Raise Both Hands in Front of Camera
              </span>
              <span className="text-xs font-medium text-white/80 leading-relaxed">
                Position both hands in the frame to launch the 3-2-1 countdown!
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-900/30 px-3 py-1 text-[11px] font-bold text-sky-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Camera Tracking Active</span>
            </div>
          </div>

          {/* Controls Quick Bar */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-xs font-semibold text-white/80 flex flex-wrap justify-center gap-x-3 gap-y-1 max-w-md text-center">
              <span><span className="font-bold text-sky-300">Tilt:</span> steer</span>
              <span>•</span>
              <span><span className="font-bold text-sky-300">Spread:</span> dash</span>
              <span>•</span>
              <span><span className="font-bold text-emerald-300">Palms:</span> shield</span>
              <span>•</span>
              <span><span className="font-bold text-red-300">Fists:</span> pause</span>
              <span>•</span>
              <span><span className="font-bold text-amber-300">Pinch:</span> fire</span>
            </div>

            {/* Hands-free menu discovery strip */}
            <div className="mt-1 flex max-w-md flex-wrap items-center justify-center gap-x-4 gap-y-1.5 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <span className="flex items-center gap-1 text-[11px] font-bold text-white/85">
                <span className="handdraw-icon flex h-6 w-6 shrink-0 items-center justify-center">
                  <PointGlyph className="h-4 w-4 text-slate-700" />
                </span>
                <span className="ml-1">move cursor</span>
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-white/85">
                <span className="handdraw-icon flex h-6 w-6 shrink-0 items-center justify-center">
                  <PinchGlyph className="h-4 w-4 text-slate-700" />
                </span>
                <span className="ml-1">pinch = click</span>
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-white/85">
                <span className="handdraw-icon flex h-6 w-6 shrink-0 items-center justify-center">
                  <UnfoldHorizontal size={14} className="text-slate-700" />
                </span>
                <span className="ml-1">spread = back</span>
              </span>
            </div>
          </div>

          {/* Back to Home CTA */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onGoToHome}
              className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-2.5 text-xs font-bold text-white/80 transition-all hover:bg-white/15 hover:text-white hover:scale-105"
            >
              <ArrowLeft size={14} />
              Return to Main Menu
            </button>
          </div>

          <span className="text-xl font-semibold">Check out my socials</span>
          <SocialMediaLinks />
        </div>
      )}

      {/* 3. COUNTDOWN STATE */}
      {!isLoading && !isCameraError && gameState === "countdown" && (
        <div className="flex items-center justify-center flex-col gap-8">
          <div className="text-3xl font-extrabold text-red-500 tracking-wider">
            GET READY!
          </div>
          <div className="text-8xl font-black bg-gradient-to-b from-white via-amber-200 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(249,115,22,0.8)]">
            {countdown > 0 ? countdown : "GO!"}
          </div>
        </div>
      )}

      {/* 4. PAUSED STATE WITH STOP GAME OPTION */}
      {!isLoading && !isCameraError && gameState === "paused" && (
        <div
          data-menu-scroll
          className="no-scrollbar flex max-h-[92vh] flex-col items-center justify-between gap-6 overflow-y-auto px-6 py-6 select-none"
        >
          <div className="flex items-center justify-center flex-col gap-2">
            <Image src="/Images/meteordash_old.png" width={70} height={70} alt="Logo" style={{ height: "auto" }} />
            <span className="text-2xl text-red-600 font-extrabold">
              Meteor Dash
            </span>
          </div>

          <div className="text-3xl animate-pulse font-extrabold text-amber-300 tracking-wider">
            P A U S E D
          </div>

          <div className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-black/40 px-6 py-3">
            <span className="text-xs font-bold uppercase tracking-widest text-white/60">
              Current Run Score
            </span>
            <span className="text-2xl font-extrabold text-amber-400">
              {distance}
            </span>
          </div>

          <div className="text-sm font-semibold text-white/80 text-center">
            Lower hands, then show both hands to continue flight...
          </div>

          {/* Pause Action Buttons: Stop Game, Start Fresh, Main Menu */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              id="stop-game-button"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 px-6 py-3 text-sm font-extrabold text-white shadow-[0_0_25px_rgba(220,38,38,0.6)] transition-all hover:scale-105 hover:bg-red-500 active:scale-95"
              onClick={onStopGame}
            >
              <StopCircle size={18} />
              Stop Game & Record Score
            </button>

            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-xs font-bold text-white/90 transition-all hover:bg-white/15 hover:text-white"
              onClick={onStartGame}
            >
              <RotateCcw size={15} />
              Start Fresh
            </button>

            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-xs font-bold text-white/90 transition-all hover:bg-white/15 hover:text-white"
              onClick={onGoToHome}
            >
              <Home size={15} />
              Main Menu
            </button>
          </div>

          <div className="max-w-xs text-center text-[11px] font-semibold leading-relaxed text-white/60">
            Hands-free menu: point one forefinger to move cursor • pinch pointed finger to click • spread to go back
          </div>
          <span className="text-lg font-semibold">Check out my socials</span>
          <SocialMediaLinks />
        </div>
      )}

      {/* 5. GAME OVER STATE */}
      {!isLoading && !isCameraError && gameState === "gameover" && (
        <div
          data-menu-scroll
          className="no-scrollbar flex max-h-[92vh] flex-col items-center justify-between gap-3 overflow-y-auto px-6 py-4 select-none"
        >
          <div className="flex items-center justify-center flex-col gap-1">
            <Image src="/Images/meteordash_old.png" width={64} height={64} alt="" style={{ height: "auto" }} />
            <span className="text-2xl text-red-600 font-extrabold">
              Meteor Dash
            </span>
          </div>
          <div className="text-xl animate-pulse font-extrabold text-red-500 tracking-wider">
            GAME OVER
          </div>
          <div className="text-lg font-extrabold text-white/90">
            {`Your High Score: ${highScore}`}
          </div>

          {runStats && (
            <>
              <div className="text-xl font-extrabold text-amber-300">
                {`Final Score: ${runStats.score}`}
              </div>
              {runStats.journey && runStats.journey.length > 0 && (
                <div className="flex w-full max-w-sm flex-col items-center gap-2">
                  <div className="text-xs font-bold uppercase tracking-widest text-white/60">
                    Journey
                  </div>
                  <div className="flex w-full flex-col gap-1.5">
                    {runStats.journey.map((v, i) => {
                      const accent =
                        ZONE_ACCENTS[(v.zone - 1) % ZONE_ACCENTS.length];
                      return (
                        <div
                          key={v.zone}
                          className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{
                                backgroundColor: accent,
                                boxShadow: `0 0 8px ${accent}`,
                              }}
                            />
                            <span className="truncate text-xs font-bold">
                              {`Zone ${v.zone} · ${v.name}`}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 text-[10px] font-bold text-white/70">
                            {v.cleared ? (
                              <span className="text-emerald-400">
                                ✓ Cleared
                              </span>
                            ) : (
                              <span className="text-red-400">✕ Ended here</span>
                            )}
                            <span className="text-white/50">
                              {v.cleared
                                ? `combo ×${v.bestCombo}`
                                : `${Math.round(v.distanceAt)}m`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {runStats.finalObjective && (
                    <div className="max-w-xs text-center text-[11px] italic text-white/60">
                      {`Mission status: ${runStats.finalObjective}`}
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-col items-center gap-2">
                <div className="text-xs font-bold uppercase tracking-widest text-white/60">
                  Badges
                </div>
                <div className="flex flex-wrap justify-center gap-2.5">
                  {BADGES.map((b) => (
                    <div key={b.id} className="flex flex-col items-center gap-1">
                      <BadgeIcon
                        id={b.id}
                        locked={!badges.some(
                          (x) => x.id === b.id && x.unlocked
                        )}
                      />
                      <span className="text-[9px] font-bold text-white/70">
                        {b.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-x-8 gap-y-2">
                {[
                  ["Max Combo", `×${runStats.maxCombo}`],
                  ["Grazes", `${runStats.grazes}`],
                  ["Power-ups", `${runStats.powerUps}`],
                  ["Dashes", `${runStats.dashes}`],
                  ["Shield Blocks", `${runStats.shields}`],
                  ["Bosses", `${runStats.bosses}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col items-center">
                    <span className="text-lg font-extrabold">{value}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-white/60">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Action Buttons: Play Again & Main Menu */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 px-7 py-3 text-sm font-extrabold text-white shadow-[0_0_25px_rgba(239,68,68,0.5)] transition-all hover:scale-105 hover:bg-red-500"
              onClick={onStartGame}
            >
              <RotateCcw size={16} />
              Play Again
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-xs font-bold text-white/90 transition-all hover:bg-white/15 hover:text-white"
              onClick={onGoToHome}
            >
              <Home size={15} />
              Main Menu
            </button>
          </div>

          <div className="max-w-xs text-center text-[11px] font-semibold leading-relaxed text-white/60">
            Hands-free menu: point one forefinger to move the cursor • pinch
            the pointed finger to click • spread to go back
          </div>
          <span className="text-xl font-semibold">Check out my socials</span>
          <SocialMediaLinks />
        </div>
      )}

      {/* Floating Buttons: Leaderboard & Buy me a Coffee for idle / gameover */}
      {!isLoading && !isCameraError && (gameState === "idle" || gameState === "gameover") && (
        <button
          type="button"
          onClick={onOpenLeaderboard}
          className="leaderboard-button fixed bottom-[6.4rem] right-4 z-40 flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/90 backdrop-blur transition-colors hover:bg-white/20"
        >
          <Trophy size={13} className="text-amber-400" />
          Leaderboard
        </button>
      )}

      {!isLoading && !isCameraError && (gameState === "idle" || gameState === "gameover") && (
        <button
          type="button"
          onClick={() => setSupportOpen(true)}
          className="leaderboard-button fixed bottom-[3.7rem] right-4 z-40 flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/90 backdrop-blur transition-colors hover:bg-white/20"
        >
          <Coffee size={13} className="text-amber-400" />
          Buy me a coffee
        </button>
      )}

      {/* Modals: Leaderboard */}
      {leaderboardOpen && (
        <div
          className="leaderboard-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={onCloseLeaderboard}
        >
          <div
            className="leaderboard-window no-scrollbar relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/15 bg-black/80 p-5 backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onCloseLeaderboard}
              aria-label="Close leaderboard"
              className="absolute top-3 right-3 text-white/50 transition-colors hover:text-white"
            >
              <X size={16} />
            </button>
            <Leaderboard
              refreshKey={leaderboardRefresh}
              highlightRunId={
                gameState === "gameover" ? postedRunId ?? undefined : undefined
              }
            />
          </div>
        </div>
      )}

      {/* Modals: Buy Me a Coffee Support */}
      {supportOpen && (
        <div
          className="leaderboard-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={closeSupport}
        >
          <div
            className="leaderboard-window no-scrollbar relative max-h-[85vh] w-full max-w-xs overflow-y-auto rounded-2xl border border-white/15 bg-black/80 p-5 backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeSupport}
              aria-label="Close support"
              className="absolute top-3 right-3 text-white/50 transition-colors hover:text-white"
            >
              <X size={16} />
            </button>
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-lg font-extrabold text-amber-300">
                <Coffee size={18} className="text-amber-400" />
                Buy me a coffee
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {UPI_PRESETS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setTip(a)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-extrabold transition-colors ${
                      tip === a
                        ? "border-amber-400/70 bg-amber-400/20 text-amber-300"
                        : "border-white/15 bg-white/5 text-white/70 hover:bg-white/15"
                    }`}
                  >
                    {`₹${a}`}
                  </button>
                ))}
              </div>
              <Image
                src={`/Images/upi-support-${tip}.png`}
                width={200}
                height={200}
                alt={`UPI QR — pay ₹${tip} to support Meteor Dash`}
                className="rounded-lg bg-white p-2"
              />
              <div className="text-center text-[11px] font-bold text-white/70">
                {`Payee: ${UPI_PAYEE_NAME} — verify before paying`}
              </div>
              <div className="text-center text-xs font-bold text-white/85">
                {`₹${tip} · scan with GPay / PhonePe / Paytm`}
              </div>
              <div className="text-center text-[10px] font-semibold text-white/50">
                {`Message auto-filled: “${UPI_NOTE}”`}
              </div>
              <div className="text-center text-[9px] font-semibold uppercase tracking-wide text-white/35">
                Your UPI PIN is entered only inside your payment app
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Copyright line */}
      {gameState === "idle" && (
        <div className="pointer-events-none fixed bottom-1.5 left-1/2 z-40 -translate-x-1/2 select-none text-center text-[10px] font-semibold tracking-wide text-white/40">
          {`© 2026 Meteor Dash · Built by Ankush Karmakar`}
        </div>
      )}

      {/* In-Game HUD: High Score, Distance, Lives, Combo, Ammo (Only when playing/countdown/paused) */}
      {(gameState === "playing" ||
        gameState === "countdown" ||
        gameState === "paused") && (
        <>
          <div className="fixed top-2 right-6 font-bold text-sm text-white/90">
            {`High Score: ${highScore > 0 ? highScore : 0}`}
          </div>
          <div className="fixed top-6 right-6 font-extrabold text-base text-amber-400">
            {`Distance: ${distance}m`}
          </div>
          <div className="fixed top-12 right-6 flex flex-row gap-1">
            {lives}
            {reserves.length > 0 && (
              <span
                className="ml-1 flex flex-row gap-1 opacity-40 saturate-50"
                title="Reserve lives — absorb the next hit"
              >
                {reserves}
              </span>
            )}
          </div>
          {combo > 1 && (
            <div className="fixed top-20 right-6 text-sm font-extrabold text-amber-400">
              {`Combo ×${combo}`}
            </div>
          )}
          {gameState === "playing" && (
            <div className="fixed top-[5.6rem] right-6 flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-sky-300/80">
                  Bolt
                </span>
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-sky-400 transition-[width] duration-200"
                    style={{ width: `${Math.min(100, shootMeter)}%` }}
                  />
                </div>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-4 rounded-full ${
                      i < boltCount ? "bg-sky-300" : "bg-white/10"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {pendingQualify && (
        <NamePrompt
          key={pendingQualify.rank}
          rank={pendingQualify.rank}
          onConfirm={onConfirmName}
          onDismiss={onDismissName}
        />
      )}

      {confettiSeed > 0 && (
        <ConfettiBurst key={confettiSeed} seed={confettiSeed} />
      )}
    </div>
  );
});

// --- Menu-gesture glyphs (inline SVG, matches the tutorial's hand-drawn
// sketch style) ---

type GlyphProps = { className?: string };

// Pointing hand: one long extended index, the rest curled into a fist.
function PointGlyph({ className }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 14V5.8a1.5 1.5 0 0 1 3 0V14" />
      <path d="M12 12.5V7.2a1.4 1.4 0 0 1 2.8 0v5.4" />
      <path d="M14.8 11.5V8.2a1.4 1.4 0 0 1 2.8 0v3.4" />
      <path d="M17.6 10.8V9a1.3 1.3 0 0 1 2.6 0v1.8" />
      <path d="M9.4 15.6c-1.6.2-2.6 1.2-2.8 2.6" />
      <path d="M12.6 15c.8.7 1.1 1.7.9 2.8" />
    </svg>
  );
}

// Pinch: thumb pressing onto a bent index finger (the menu "click").
function PinchGlyph({ className }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9.5 13.5V7.6a1.5 1.5 0 0 1 3 0v4.6" />
      <path d="M12.5 12V7.8a1.4 1.4 0 0 1 2.8 0v4.2" />
      <path d="M15.3 11V8.4a1.4 1.4 0 0 1 2.8 0v2.8" />
      <path d="M18 10.4V9.4a1.3 1.3 0 0 1 2.6 0v1" />
      <path d="M9 11.3c-1.4.3-2.1 1.5-1.9 2.8" />
    </svg>
  );
}

export default GameInfoOverlay;

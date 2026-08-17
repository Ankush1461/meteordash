import {
  Coffee,
  Loader2,
  Lock,
  Moon,
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
import { BadgeIcon, BADGES, type BadgeId } from "@/utils/badges";
import { type RocketSkin, type SkinId } from "@/utils/skins";
import {
  UPI_AMOUNT,
  UPI_NOTE,
  UPI_PAYEE_NAME,
  UPI_PRESETS,
} from "@/lib/game/support";

export type GameState =
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
  const [supportOpen, setSupportOpen] = useState(false);  // Tip selection: a preset amount, each with its own static build-time QR.
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
  // done as a render-phase adjustment, the React-recommended way to derive
  // state from a prop change without a cascading effect.
  if (supportOpen && gameState !== "idle" && gameState !== "gameover") {
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
      className={`absolute z-30 h-screen w-screen flex items-center justify-center ${isColliding && "border-[18px] border-red-600 "
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
        <div className="flex items-center justify-space-between flex-col gap-10">
          <div className="text-2xl font-bold">
            Welcome to{" "}
            <span className="text-2xl text-red-600 font-extrabold">
              Meteor Dash
            </span>
          </div>
          <Loader2 size={80} className="animate-spin" />
        </div>
      )}
      {!isLoading && isCameraError && (
        <div className="flex items-center justify-center flex-col gap-6">
          <div className="text-3xl font-extrabold text-red-600">
            Camera unavailable
          </div>
          <div className="text-md font-bold max-w-md text-center">
            {cameraError}
          </div>
          <button
            className="bg-transparent hover:bg-red-600 text-red-600 hover:text-white border border-red-600 hover:border-transparent rounded py-2 px-4"
            onClick={onRetry}
          >
            Try Again
          </button>
        </div>
      )}
      {!isLoading && !isCameraError && gameState === "idle" && (
        <div
          data-menu-scroll
          className="no-scrollbar flex max-h-[92vh] flex-col items-center justify-space-between gap-10 overflow-y-auto px-6 py-6"
        >
          <div className="flex items-center justify-center flex-col gap-2">
            <Image src="/Images/meteordash.png" width={80} height={80} alt="" />
            <span className="text-3xl text-red-600 font-extrabold">
              Meteor Dash
            </span>
          </div>
          <div className="text-2xl animate-ping font-extrabold">
            Let&apos;s start
          </div>
          <div className="text-md font-bold">
            Show both hands to start, tilt to steer
          </div>
          <div className="text-sm font-semibold text-white/80">
            Spread hands: dash • Flat palms: shield • Fists: pause • Pinch:
            fire
          </div>

          {/* Hands-free menu discovery strip — teaches the pointing-finger
              cursor and pinch-click before the player ever needs to pause. */}
          <div className="mt-0.5 flex max-w-md flex-wrap items-center justify-center gap-x-4 gap-y-1.5 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
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

          <div className="flex flex-col items-center gap-2">
            <div className="text-xs font-bold uppercase tracking-widest text-white/60">
              Your Ship
            </div>
            <div className="flex items-center gap-3">
              <RocketSprite skin={skin} size={56} />
              <div className="flex flex-col items-start gap-0.5">
                <span
                  className="text-lg font-extrabold"
                  style={{ color: skin.glow }}
                >
                  {skin.name}
                </span>
                <span className="max-w-[220px] text-left text-[11px] font-semibold text-white/60">
                  {skin.description}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {skins.map((s) => {
                const unlocked = unlockedSkinIds.includes(s.id);
                const selected = s.id === skin.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => onSelectSkin(s.id)}
                    title={
                      unlocked ? s.name : `Locked — ${s.unlockHint}`
                    }
                    aria-label={
                      unlocked ? s.name : `Locked: ${s.unlockHint}`
                    }
                    className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 bg-black/40 transition-all ${unlocked
                      ? "cursor-pointer hover:scale-110"
                      : "cursor-not-allowed opacity-45 grayscale"
                      }`}
                    style={{
                      borderColor: selected
                        ? s.glow
                        : unlocked
                          ? `${s.glow}77`
                          : "#44403c",
                      boxShadow: selected ? `0 0 12px ${s.glow}` : undefined,
                    }}
                  >
                    <RocketSprite skin={s} size={22} />
                    {!unlocked && (
                      <Lock
                        size={11}
                        className="absolute bottom-0 right-0 text-stone-500"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <span className="text-2xl font-semibold">Check out my socials</span>
          <SocialMediaLinks />
        </div>
      )}
      {!isLoading && !isCameraError && gameState === "countdown" && (
        <div className="flex items-center justify-space-between flex-col gap-8">
          <div className="text-3xl font-extrabold text-red-600">
            Get Ready!
          </div>
          <div className="text-8xl font-extrabold">
            {countdown > 0 ? countdown : "GO!"}
          </div>
        </div>
      )}
      {!isLoading && !isCameraError && gameState === "paused" && (
        <div
          data-menu-scroll
          className="no-scrollbar flex max-h-[92vh] flex-col items-center justify-space-between gap-6 overflow-y-auto px-6 py-6"
        >
          <div className="flex items-center justify-center flex-col gap-2">
            <Image src="/Images/meteordash.png" width={80} height={80} alt="" />
            <span className="text-3xl text-red-600 font-extrabold">
              Meteor Dash
            </span>
          </div>

          <div className="text-2xl animate-ping font-extrabold">
            P A U S E D
          </div>
          <button
            className="bg-transparent hover:bg-red-600 text-red-600 hover:text-white border border-red-600 hover:border-transparent rounded py-2 px-4"
            onClick={() => window.location.reload()}
          >
            Start Fresh
          </button>
          <div className="text-md font-bold">
            Lower hands, then show both hands to continue...
          </div>
          <div className="max-w-xs text-center text-[11px] font-semibold leading-relaxed text-white/60">
            Hands-free menu: point one forefinger to move the cursor • pinch
            the pointed finger to click • spread to go back
          </div>
          <span className="text-xl font-semibold">Check out my socials</span>
          <SocialMediaLinks />
        </div>
      )}
      {!isLoading && !isCameraError && gameState === "gameover" && (
        <div
          data-menu-scroll
          className="no-scrollbar flex max-h-[92vh] flex-col items-center justify-space-between gap-3 overflow-y-auto px-6 py-4"
        >
          <div className="flex items-center justify-center flex-col gap-1">
            <Image src="/Images/meteordash.png" width={64} height={64} alt="" />
            <span className="text-2xl text-red-600 font-extrabold">
              Meteor Dash
            </span>
          </div>
          <div className="text-xl animate-ping font-extrabold">GAME OVER</div>
          <div className="text-lg font-extrabold">
            {`Your High Score: ${highScore}`}
          </div>

          {runStats && (
            <>
              <div className="text-lg font-extrabold text-amber-300">
                {`Run Score: ${runStats.score}`}
              </div>
              {runStats.journey && runStats.journey.length > 0 && (
                <div className="flex w-full max-w-sm flex-col items-center gap-2">
                  <div className="text-xs font-bold uppercase tracking-widest text-white/60">
                    Journey
                  </div>
                  <div className="flex w-full flex-col gap-1.5">
                    {runStats.journey.map((v, i) => {
                      const isLast = i === runStats.journey.length - 1;
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
                              <span className="text-red-400">✕ Fell here</span>
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
                      {`Mission incomplete: ${runStats.finalObjective}`}
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

          <button
            className="bg-transparent hover:bg-red-600 text-red-600 hover:text-white border border-red-600 hover:border-transparent rounded py-2 px-4"
            onClick={() => window.location.reload()}
          >
            Play Again
          </button>
          <div className="max-w-xs text-center text-[11px] font-semibold leading-relaxed text-white/60">
            Hands-free menu: point one forefinger to move the cursor • pinch
            the pointed finger to click • spread to go back
          </div>
          <span className="text-2xl font-semibold">Check out my socials</span>
          <SocialMediaLinks />
        </div>
      )}
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
      {leaderboardOpen && (
        <div
          className="leaderboard-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={onCloseLeaderboard}
        >
          <div
            className="leaderboard-window no-scrollbar relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/15 bg-black/70 p-5 backdrop-blur-md"
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
              highlightRunId={gameState === "gameover" ? (postedRunId ?? undefined) : undefined}
            />
          </div>
        </div>
      )}
      {supportOpen && (
        <div
          className="leaderboard-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={closeSupport}
        >
          <div
            className="leaderboard-window no-scrollbar relative max-h-[85vh] w-full max-w-xs overflow-y-auto rounded-2xl border border-white/15 bg-black/70 p-5 backdrop-blur-md"
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
      {gameState === "idle" && (
        <div className="pointer-events-none fixed bottom-1.5 left-1/2 z-40 -translate-x-1/2 select-none text-center text-[10px] font-semibold tracking-wide text-white/40">
          {`© 2026 Meteor Dash · Built by Ankush Karmakar`}
        </div>
      )}
      <div className="fixed top-2 right-6">{`High Score: ${highScore > 0 ? highScore : 0
        }`}</div>
      <div className="fixed top-6 right-6">{`Distance: ${distance}`}</div>
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
                className={`h-1.5 w-4 rounded-full ${i < boltCount ? "bg-sky-300" : "bg-white/10"
                  }`}
              />
            ))}
          </div>
        </div>
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

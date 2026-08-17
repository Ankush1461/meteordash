"use client";
import Cookies from "js-cookie";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GameState,
  RunStats,
  ZoneVisit,
} from "@/components/GameInfoOverlay";
import type { Boulder } from "@/components/BoulderComponent";
import type { ParticleData } from "@/components/Particle";
import {
  BADGES,
  readUnlockedBadges,
  saveUnlockedBadges,
  type BadgeId,
} from "@/utils/badges";
import {
  getSkin,
  readSelectedSkin,
  saveSelectedSkin,
  type SkinId,
} from "@/utils/skins";
import {
  playClick,
  playFX,
  setBossIntensity,
  setZoneTint,
} from "@/utils/audioHandler";
import { signRunPayload } from "@/lib/game/sign";
import { getZone, getZoneStory, ZONE_THEMES } from "@/lib/game/zones";
import { BOSS_TUNING, bossDuration } from "@/lib/game/bosses";
import {
  fallDuration,
  fallSpeed,
  gameplayScale,
  spriteScale,
} from "@/lib/game/physics";
import {
  boltReward,
  bossClearBonus,
  distanceTickIncrement,
  grazePoints,
  powerUpPoints,
} from "@/lib/game/scoring";
import {
  COLLISION_INSET,
  COMBO_MAX,
  COMBO_WINDOW_MS,
  COUNTDOWN_SECONDS,
  DASH_COOLDOWN_MS,
  DASH_COLORS,
  DASH_IFRAMES_MS,
  DEFAULT_SENSITIVITY,
  DOUBLE_DURATION_MS,
  FROST_FACTOR,
  FROST_HITS_TO_LIFE,
  FROST_MS,
  GESTURE_HOLD_FRAMES,
  GRAZE_RADIUS,
  INVINCIBILITY_MS,
  MAX_PARTICLES,
  POWER_UP_INTERVAL,
  MENU_CURSOR_DPI,
  MENU_SNAP_RADIUS,
  MENU_CLICK_GRACE,
  MENU_POINT_LOST_FRAMES,
  RESERVE_LIVES_MAX,
  SHOOT_CHARGE_FULL_MS,
  SHOOT_CHARGE_MS,
  SHOOT_CHARGED_MIN,
  SHOOT_ENERGY_CHARGED_COST,
  SHOOT_ENERGY_COST,
  SHOOT_MAX_BOLTS,
  SHOOT_METER_MAX,
  SHOOT_METER_PER_DASH,
  SHOOT_METER_PER_GRAZE,
  BOLT_BOSS_DAMAGE,
  BOLT_BOSS_DAMAGE_CHARGED,
  BOLT_SPEED,
  SCORE_TICK_MS,
  SHAKE_AMOUNT,
  SHAKE_DURATION_MS,
  SHIELD_BLOCK_ENERGY,
  SHIELD_DRAIN_PER_S,
  SHIELD_RECHARGE_PER_S,
  SLOWMO_DURATION_MS,
  SLOWMO_FACTOR,
  SPAWN_INTERVAL_MS,
  START_LIVES,
  TILT_SMOOTHING,
  TRAIL_EMIT_INTERVAL,
  ZONE_DISTANCE,
} from "@/lib/game/constants";
import type {
  Banner,
  Bolt,
  BossProjectile,
  PowerUp,
  PowerUpType,
  ScorePopup,
} from "@/lib/game/types";
import { POWER_UP_COLORS } from "@/lib/game/powerupColors";

// Darkens/lightens a hex color by `amount` (-1..1; negative darkens) so the
// engine trail can layer a cooler ember around the skin's flame color.
function shadeFlame(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const f = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * (1 + amount))));
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

// The whole game engine lives here: the rAF loop, meteor physics, boss
// fights, gesture recognition, the state machine, the tutorial, and the
// client side of the leaderboard flow. `app/page.tsx` only composes the
// returned state/refs into JSX, so nothing game-logical re-renders with it.
export function useGameEngine() {
  const [isDetected, setIsDetected] = useState(false);
  const [boulders, setBoulders] = useState<Boulder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isColliding, setIsColliding] = useState(false);
  const [distance, setDistance] = useState(0);
  const [livesRemainingState, setLivesRemainingState] = useState(START_LIVES);
  const [reserveLives, setReserveLives] = useState(0);
  // Bumped every time a run posts its score so the leaderboard refetches;
  // postedRunId highlights the just-finished run's row on the game-over board.
  const [leaderboardRefresh, setLeaderboardRefresh] = useState(0);
  const [postedRunId, setPostedRunId] = useState<string | null>(null);
  // Set when a run cracks the top-10 and is awaiting the player's callsign.
  const [pendingQualify, setPendingQualify] = useState<{ rank: number } | null>(
    null
  );
  // Snapshot of the finished run, posted only after the name is confirmed.
  const pendingRunRef = useRef<Record<string, unknown> | null>(null);
  // Random seed per landed run; 0 = no burst yet. Generated in an async
  // callback (never during render) so ConfettiBurst stays render-pure.
  const [confettiSeed, setConfettiSeed] = useState(0);
  // Floating leaderboard window open state — owned here so the confirm
  // handler can pop it open (with a fresh fetch) right after a save.
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [highScore, setHighScore] = useState(0);
  const [sensitivity, setSensitivity] = useState(DEFAULT_SENSITIVITY);
  const [cameraError, setCameraError] = useState<string | null>(null);
  // True while the recognizer reports the room is too dark for reliable
  // hand tracking (average video brightness below its threshold).
  const [lowLight, setLowLight] = useState(false);
  const [cameraRetry, setCameraRetry] = useState(0);
  const [particles, setParticles] = useState<ParticleData[]>([]);
  const [zone, setZone] = useState(1);
  const [zoneBanner, setZoneBanner] = useState<Banner | null>(null);
  const [bossActive, setBossActive] = useState(false);
  const [bossFlash, setBossFlash] = useState(false);
  const [bossBarVisible, setBossBarVisible] = useState(false);
  const [frosted, setFrosted] = useState(false);
  const [bossProjectiles, setBossProjectiles] = useState<BossProjectile[]>([]);
  const [combo, setCombo] = useState(1);
  const [shield, setShield] = useState(false);
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
  const [isDashing, setIsDashing] = useState(false);
  const [gestureShield, setGestureShield] = useState(false);
  // Pinch-to-fire: the shot meter (fills from grazes/dashes) + bolts in flight.
  const [shootMeter, setShootMeter] = useState(0);
  const [bolts, setBolts] = useState<Bolt[]>([]);
  const [tutorialStep, setTutorialStep] = useState(1);
  const [badges, setBadges] = useState<{ id: BadgeId; unlocked: boolean }[]>(
    () => BADGES.map((b) => ({ id: b.id, unlocked: false }))
  );
  // Selected rocket skin (persisted); unlock rules live in utils/skins.ts.
  const [skinId, setSkinId] = useState<SkinId>("classic");
  const [gameOverStats, setGameOverStats] = useState<RunStats | null>(null);

  const rocketRef = useRef<HTMLDivElement>(null);
  // Rocket steering lives in refs + direct DOM writes (inside the rAF loop),
  // so hand-tracking frames never re-render the page.
  const rocketLeftRef = useRef(0);
  const rocketTiltRef = useRef<HTMLDivElement>(null);
  const shakeWrapperRef = useRef<HTMLDivElement>(null);
  const starfieldSpeedRef = useRef(0);

  // Mutable game state owned by the animation loop, not React state.
  const bouldersRef = useRef<Boulder[]>([]);
  const boulderElsRef = useRef(new Map<string, HTMLDivElement>());
  const livesRemainingRef = useRef(START_LIVES);
  const reserveLivesRef = useRef(0);
  // Idempotency key for the leaderboard: one score post per run.
  const runIdRef = useRef("");
  // When the current run started, so the leaderboard post can include its
  // wall-clock length for server-side speed/rate validation.
  const runStartTimeRef = useRef(0);
  // HMAC signing token issued by the server at run start; used to sign the
  // run data at submission so the API rejects unsigned/tampered scores.
  const leaderboardTokenRef = useRef<string | null>(null);
  const highScoreRef = useRef(0);
  const gameStateRef = useRef<GameState>("idle");
  const countdownRef = useRef(COUNTDOWN_SECONDS);
  const countdownStartRef = useRef(0);
  const distanceRef = useRef(0);
  const sensitivityRef = useRef(DEFAULT_SENSITIVITY);
  // Selected skin mirrored into a ref so the rAF loop's engine-trail
  // particles can use the skin's flame color without re-subscribing.
  const skinRef = useRef(getSkin("classic"));
  const smoothedDegreesRef = useRef(0);
  const hasSmoothedSampleRef = useRef(false);
  const particlesRef = useRef<ParticleData[]>([]);
  const particleElsRef = useRef(new Map<string, HTMLDivElement>());
  const zoneRef = useRef(1);
  const bossActiveRef = useRef(false);
  const bossEnteringRef = useRef(false);
  const bossEntranceElapsedRef = useRef(0);
  const bossHpRef = useRef(1);
  const bossIndexRef = useRef(0);
  const nextBossAtRef = useRef(ZONE_DISTANCE);
  const bossBaseXRef = useRef(0);
  const bossFireTimerRef = useRef(0);
  // Counts volleys within a single fight so bruiser guardians can alternate
  // between their primary and secondary attack patterns.
  const bossVolleyRef = useRef(0);
  // Unshielded frost-shard hits accrued this run; at FROST_HITS_TO_LIFE the
  // hull freezes solid and a life is lost.
  const frostHitsRef = useRef(0);
  const frostedRef = useRef(false);
  const frostFactorRef = useRef(1);
  const bossProjectilesRef = useRef<BossProjectile[]>([]);
  const bossProjectileElsRef = useRef(new Map<string, HTMLDivElement>());
  const bossRef = useRef<HTMLDivElement>(null);
  const bossBarFillRef = useRef<HTMLDivElement>(null);
  const bannerTimeoutRef = useRef<number | null>(null);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const powerUpElsRef = useRef(new Map<string, HTMLDivElement>());
  // Player bolts (pinch-to-fire): refs + direct DOM writes in the loop, with
  // React state only for mount/unmount.
  const boltsRef = useRef<Bolt[]>([]);
  const boltElsRef = useRef(new Map<string, HTMLDivElement>());
  const shootMeterRef = useRef(0);
  const pinchHeldRef = useRef(false);
  const pinchStartRef = useRef(0);
  const scorePopupsRef = useRef<ScorePopup[]>([]);
  const scorePopupElsRef = useRef(new Map<string, HTMLDivElement>());
  const comboRef = useRef(1);
  const scoreBonusRef = useRef(0);
  const shieldRef = useRef(false);

  // Gesture recognition state (debounce counters + edge-trigger latches).
  const gestureHoldRef = useRef({
    dash: 0,
    shield: 0,
    fist: 0,
    pinch: 0,
    spread: 0,
    pointPinch: 0,
  });
  const dashHeldRef = useRef(false);
  const dashCooldownUntilRef = useRef(0);
  const dashUntilRef = useRef(0);
  const gestureShieldActiveRef = useRef(false);
  const gestureShieldEnergyRef = useRef(100);
  const gestureShieldVisibleRef = useRef(false);
  const fistPauseHeldRef = useRef(false);
  const fistPauseLatchRef = useRef(false);
  // True while a countdown started from the pause menu is running, so a
  // hands-drop returns to "paused" instead of abandoning the live run to
  // idle (where a fresh-run reset would wipe its stats).
  const resumingRef = useRef(false);
  const shieldRingRef = useRef<HTMLDivElement>(null);
  // Menu navigation (idle / game-over): a pointing hand drives a cursor;
  // fist confirms (clicks the hovered button), spread goes back. Cursor
  // position + hover live in refs with direct DOM writes — no re-renders.
  const menuCursorRef = useRef<HTMLDivElement>(null);
  const menuCursorXRef = useRef(0);
  const menuCursorYRef = useRef(0);
  const menuCursorHasRef = useRef(false);
  // Latches the pointing-hand pinch so a held pinch doesn't double-click.
  const menuClickHeldRef = useRef(false);
  // Consecutive frames the pinch has been OFF (a flickering thumb must be
  // genuinely released before a new pinch can arm), and a short cooldown
  // after each click so micro-releases can't machine-gun buttons.
  const pointPinchOffFramesRef = useRef(99);
  const pointPinchCooldownUntilRef = useRef(0);
  const menuHoveredElRef = useRef<HTMLElement | null>(null);
  // The button the cursor is currently magnetically locked onto (snap
  // hysteresis), and consecutive frames the pointing pose has been lost
  // (grace so a single flicker doesn't blink the cursor).
  const menuSnappedElRef = useRef<HTMLElement | null>(null);
  const pointLostFramesRef = useRef(0);
  const spreadMenuHeldRef = useRef(false);
  // The page's gesture-guide toggle + a bridge so the engine can close it.
  const guideOpenRef = useRef(false);
  const menuBackRef = useRef<() => void>(() => {});
  // Mirror leaderboard/prompt state into refs (setHandResults is a stable
  // closure, so it must read refs, not state).
  const leaderboardOpenRef = useRef(false);
  const pendingQualifyRef = useRef<{ rank: number } | null>(null);
  const tutorialStepRef = useRef(1);
  const tutorialSeenRef = useRef(false);
  const tiltMarkerElRef = useRef<HTMLDivElement>(null);
  const unlockedRef = useRef(new Set<BadgeId>());
  const runStatsRef = useRef({
    score: 0,
    maxCombo: 1,
    grazes: 0,
    powerUps: 0,
    dashes: 0,
    shields: 0,
    bosses: 0,
  });
  // The run's journey through the zones: one entry per zone, advanced as
  // guardians fall. Snapshot into gameOverStats at death for the log view.
  const journeyRef = useRef<ZoneVisit[]>([]);
  const zoneIntroShownRef = useRef(false);
  const pendingBannerRef = useRef<number | null>(null);

  // Bridges so setHandResults can spawn effects that live in the game loop.
  const spawnExplosionRef = useRef<
    (x: number, y: number, count: number, colors?: string[]) => void
  >(() => {});
  const spawnScorePopupRef = useRef<
    (x: number, y: number, text: string, color?: string) => void
  >(() => {});

  // --- Menu navigation helpers (point → move, fist → confirm, spread → back) ---

  // The nearest enabled button (or input) within `radius` px of (x, y), or
  // null. Used for the magnetic snap (buttons pull the cursor in) and the
  // forgiving click (a slightly-off confirm still lands). Screens have a
  // handful of buttons, so scanning every frame at 30Hz is cheap. Anything
  // covered by an overlay (e.g. an open modal) is skipped: the snap and the
  // forgiving click must never target a button the player can't see.
  const nearestMenuButton = (
    x: number,
    y: number,
    radius: number
  ): HTMLElement | null => {
    let best: HTMLElement | null = null;
    let bestD = radius;
    const els = document.querySelectorAll(
      "button:not([disabled]), input:not([disabled])"
    ) as NodeListOf<HTMLElement>;
    for (const b of els) {
      if (!b.isConnected) continue;
      const r = b.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue; // hidden / collapsed
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      // Skip buttons hidden behind an overlay — elementFromPoint respects
      // clipping AND stacking, so a button under an open modal's backdrop
      // (or scrolled out of its container) is excluded here.
      const top = document.elementFromPoint(cx, cy);
      if (top && top !== b && !b.contains(top)) continue;
      const d = Math.hypot(cx - x, cy - y);
      if (d <= bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  };

  // Move the cursor to (x, y) px, EMA-smoothed, then magnetically snap it
  // onto the nearest button when it's close enough (MENU_SNAP_RADIUS) so
  // small wrist errors glide onto the target instead of missing it. The
  // snapped cursor turns amber — "locked" — so the player sees exactly
  // what a pinch will confirm. Also nudge the scrollable menu when the
  // hand nears the screen edges.
  const updateMenuCursor = (nx: number, ny: number) => {
    // Alpha 0.5 (≈33ms time constant at the 30Hz hand frame rate) keeps the
    // cursor tight to the fingertip — responsive enough to aim at a button,
    // smooth enough to not shiver on the index tip's jitter.
    menuCursorXRef.current = menuCursorHasRef.current
      ? menuCursorXRef.current + 0.5 * (nx - menuCursorXRef.current)
      : nx;
    menuCursorYRef.current = menuCursorHasRef.current
      ? menuCursorYRef.current + 0.5 * (ny - menuCursorYRef.current)
      : ny;
    menuCursorHasRef.current = true;
    const x = menuCursorXRef.current;
    const y = menuCursorYRef.current;
    // Magnetic assist: within MENU_SNAP_RADIUS of a button's centre, glide
    // the cursor onto it. The pull is capped (≤50% of the remaining
    // distance, ≤80px per frame) so it converges smoothly and never jumps.
    // Hysteresis: once locked onto a button, keep it until the cursor moves
    // well clear (1.25× the snap radius) — otherwise the nearest button
    // flips between two close buttons and the amber lock + hover flicker.
    let snap = nearestMenuButton(x, y, MENU_SNAP_RADIUS);
    const held = menuSnappedElRef.current;
    if (held && held !== snap && held.isConnected) {
      const hr = held.getBoundingClientRect();
      const hd = Math.hypot(
        hr.x + hr.width / 2 - x,
        hr.y + hr.height / 2 - y
      );
      if (hd <= MENU_SNAP_RADIUS * 1.25) snap = held;
    }
    menuSnappedElRef.current = snap;
    let sx = x;
    let sy = y;
    if (snap) {
      const r = snap.getBoundingClientRect();
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      const dx = cx - x;
      const dy = cy - y;
      const dist = Math.hypot(dx, dy) || 1;
      const pull = Math.min(0.5, 80 / dist);
      sx = x + dx * pull;
      sy = y + dy * pull;
      menuCursorXRef.current = sx;
      menuCursorYRef.current = sy;
    }
    const cur = menuCursorRef.current;
    if (cur) {
      cur.style.transform = `translate3d(${sx - 11}px, ${sy - 11}px, 0)`;
      cur.style.opacity = "1";
      // Amber ring while locked onto a button — the player can see the
      // capture before they click.
      cur.classList.toggle("lock", !!snap);
    }
    // Hover highlight for the button/input under the (snapped) cursor.
    const el = document.elementFromPoint(sx, sy);
    const btn = (el?.closest?.("button, input") as HTMLElement | null) ?? null;
    const prev = menuHoveredElRef.current;
    if (prev && prev !== btn) {
      prev.classList.remove("menu-hover");
    }
    if (btn && btn !== prev && !(btn as HTMLButtonElement).disabled) {
      btn.classList.add("menu-hover");
      menuHoveredElRef.current = btn;
    } else {
      menuHoveredElRef.current = btn;
    }
    // Edge-scroll the menu panel: only while the cursor is INSIDE the panel,
    // near its top/bottom edge, and not locked onto a button (scrolling the
    // target under an aimed cursor makes the cursor chase it). Gentle 8px
    // steps so a tall game-over panel scrolls smoothly instead of flying.
    const scrollEl = document.querySelector("[data-menu-scroll]");
    if (scrollEl && !snap) {
      const pr = scrollEl.getBoundingClientRect();
      const inPanel =
        y >= pr.top && y <= pr.bottom && x >= pr.left && x <= pr.right;
      if (inPanel && y < pr.top + pr.height * 0.15) {
        scrollEl.scrollTop -= 8;
      } else if (inPanel && y > pr.bottom - pr.height * 0.15) {
        scrollEl.scrollTop += 8;
      }
    }
  };

  // Drop the hover highlight + lock ring when the cursor hides.
  const clearMenuHighlight = () => {
    const cur = menuCursorRef.current;
    if (cur) cur.classList.remove("lock");
    menuSnappedElRef.current = null;
    const prev = menuHoveredElRef.current;
    if (prev) {
      prev.classList.remove("menu-hover");
      menuHoveredElRef.current = null;
    }
  };

  // Fade the cursor + drop its highlight/lock, but KEEP the last position
  // so a fist (confirm) pressed right after lowering the point still clicks
  // what the player was aiming at — hiding is visual, not forgetful.
  const hideMenuCursor = () => {
    const cur = menuCursorRef.current;
    if (cur) cur.style.opacity = "0";
    clearMenuHighlight();
  };

  // Fist or pointing-pinch → click whatever button is under the cursor
  // (last known position if the point was just lowered). Forgiving: if the
  // cursor isn't exactly on a button, the nearest enabled button within
  // MENU_CLICK_GRACE is clicked instead — a slightly-off pinch still
  // confirms the intended target. Every successful click pops the cursor
  // (haptic-style pulse) and plays a short "tock" so the confirm lands
  // with feedback even if the player isn't looking at it.
  const confirmMenu = () => {
    if (!menuCursorHasRef.current) return;
    const x = menuCursorXRef.current;
    const y = menuCursorYRef.current;
    const el = document.elementFromPoint(x, y);
    let target = (el?.closest?.("button, input") as HTMLElement | null) ?? null;
    if (
      !target ||
      !target.isConnected ||
      (target as HTMLButtonElement).disabled
    ) {
      target = nearestMenuButton(x, y, MENU_CLICK_GRACE);
    }
    if (
      target &&
      target.isConnected &&
      !(target as HTMLButtonElement).disabled
    ) {
      // An input (e.g. the callsign box) is focused, not clicked, so the
      // player can pinch to aim at it and then type with the keyboard.
      if (target instanceof HTMLInputElement) {
        target.focus();
      } else {
        (target as HTMLButtonElement).click();
      }
      const cur = menuCursorRef.current;
      if (cur) {
        cur.classList.remove("pulse");
        void cur.offsetWidth; // restart the animation on rapid re-clicks
        cur.classList.add("pulse");
      }
      playClick();
    }
  };

  // Spread → go back: close whatever panel is open.
  const backMenu = () => {
    if (leaderboardOpenRef.current) {
      setLeaderboardOpen(false);
    }
    if (pendingQualifyRef.current) {
      setPendingQualify(null);
      pendingRunRef.current = null;
    }
    menuBackRef.current?.();
  };

  // The shot meter fills ONLY from grazes and dashes — never passively — so
  // the only way to earn a bolt is to keep flying dangerously.
  const gainShootMeter = (amount: number) => {
    const next = Math.min(SHOOT_METER_MAX, shootMeterRef.current + amount);
    if (next !== shootMeterRef.current) {
      shootMeterRef.current = next;
      setShootMeter(next);
    }
  };

  // Spawn a player bolt at the rocket's nose. Gated by the meter AND the
  // ammo cap (bolts in flight) so you can never chain-fire a clear path —
  // each shot is earned, and the cap refreshes as bolts resolve.
  const fireBolt = (charge: number) => {
    if (gameStateRef.current !== "playing") return;
    const active = boltsRef.current.filter((b) => !b.hit).length;
    if (active >= SHOOT_MAX_BOLTS) {
      const r = rocketRef.current?.getBoundingClientRect();
      if (r) {
        spawnScorePopupRef.current(
          (r.left + r.right) / 2,
          r.top - 12,
          "Ammo full",
          "#94a3b8"
        );
      }
      return;
    }
    const charged = charge >= SHOOT_CHARGED_MIN;
    const cost = charged ? SHOOT_ENERGY_CHARGED_COST : SHOOT_ENERGY_COST;
    if (shootMeterRef.current < cost) {
      const r = rocketRef.current?.getBoundingClientRect();
      if (r) {
        spawnScorePopupRef.current(
          (r.left + r.right) / 2,
          r.top - 12,
          "No energy",
          "#94a3b8"
        );
      }
      return;
    }
    shootMeterRef.current -= cost;
    setShootMeter(shootMeterRef.current);
    const rocket = rocketRef.current?.getBoundingClientRect();
    const x = rocket ? (rocket.left + rocket.right) / 2 : window.innerWidth / 2;
    const y = rocket ? rocket.top - 6 : 0;
    boltsRef.current = [
      ...boltsRef.current,
      {
        key: `bolt-${Date.now()}-${Math.random()}`,
        x,
        y,
        charge: charged ? 1 : 0,
        size: charged ? 16 : 10,
        hit: false,
      },
    ];
    setBolts(boltsRef.current);
    // Muzzle flash: charged shots kick out a brighter burst.
    spawnExplosionRef.current(x, y, charged ? 12 : 8, [
      "#7dd3fc",
      "#e0f2fe",
      "#ffffff",
    ]);
    spawnScorePopupRef.current(
      x,
      y - 18,
      charged ? "CHARGED!" : "Fire!",
      charged ? "#7dd3fc" : "#e0f2fe"
    );
  };

  // Mirror modal panel state into refs for the stable setHandResults closure.
  useEffect(() => {
    leaderboardOpenRef.current = leaderboardOpen;
  }, [leaderboardOpen]);
  useEffect(() => {
    pendingQualifyRef.current = pendingQualify;
  }, [pendingQualify]);

  // Keep the loop's view of the state machine in sync with React state.
  const transitionTo = useCallback((next: GameState) => {
    gameStateRef.current = next;
    setGameState(next);
  }, []);

  // Top-10 prompt accepted: persist the callsign, sign the run with the
  // run-start token, then post it. Without a token the server rejects the
  // submission (fail-closed) — the board simply won't show the run.
  const confirmLeaderboardName = useCallback(async (name: string) => {
    const payload = pendingRunRef.current;
    if (!payload) return;
    const clean =
      name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 16) ||
      "Pilot";
    Cookies.set("pilotName", clean, { expires: 365 });
    setPendingQualify(null);
    pendingRunRef.current = null;
    const token = leaderboardTokenRef.current;
    let sig = "";
    if (token) {
      try {
        sig = await signRunPayload(token, payload);
      } catch {
        // Signature failure leaves sig empty → server rejects. Fail closed.
      }
    }
    window
      .fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, name: clean, token: token ?? "", sig }),
      })
      .then((res) => {
        if (res.ok) {
          // Only after the score has actually landed: highlight it, refetch
          // the board (so the GET sees the new entry), pop the leaderboard
          // window open (it mounts fresh → fetches), and fire confetti.
          setPostedRunId(payload.runId as string);
          setLeaderboardRefresh((n) => n + 1);
          setConfettiSeed(() => Math.floor(Math.random() * 2 ** 31));
          setLeaderboardOpen(true);
        }
      })
      .catch(() => {});
  }, []);

  // Top-10 prompt dismissed: the run is not posted.
  const dismissLeaderboardName = useCallback(() => {
    pendingRunRef.current = null;
    setPendingQualify(null);
  }, []);

  // Finishing (or skipping) the tutorial persists it and starts the countdown.
  // Unlock a badge once, persist it immediately (so it survives a closed tab)
  // and refresh the game-over screen's badge row.
  const unlockBadge = useCallback((id: BadgeId) => {
    if (unlockedRef.current.has(id)) return;
    unlockedRef.current.add(id);
    saveUnlockedBadges([...unlockedRef.current]);
    setBadges(
      BADGES.map((b) => ({
        id: b.id,
        unlocked: unlockedRef.current.has(b.id),
      }))
    );
  }, []);

  // Fresh run: clear the journey log and open zone 1.
  const initJourney = () => {
    zoneIntroShownRef.current = false;
    journeyRef.current = [
      {
        zone: 1,
        name: getZone(1).name,
        cleared: false,
        distanceAt: 0,
        bestCombo: 1,
      },
    ];
  };

  // Reset every per-run counter so a fresh run starts from a clean slate:
  // distance, bonus, combo, zone/boss progress, lives, shield state — and
  // the leaderboard run identity (runId + its signing token). Never run this
  // when RESUMING a paused run: that path must keep its stats and token.
  const resetForFreshRun = useCallback(() => {
    runStatsRef.current = {
      score: 0,
      maxCombo: 1,
      grazes: 0,
      powerUps: 0,
      dashes: 0,
      shields: 0,
      bosses: 0,
    };
    setGameOverStats(null);
    reserveLivesRef.current = 0;
    setReserveLives(0);
    runIdRef.current = crypto.randomUUID();
    setPostedRunId(null);
    setPendingQualify(null);
    pendingRunRef.current = null;
    runStartTimeRef.current = performance.now();
    leaderboardTokenRef.current = null;
    resumingRef.current = false;
    // The distance meter doubles as the base score: zero it AND the bonus
    // pool so a new run never inherits the previous run's meters or points.
    distanceRef.current = 0;
    setDistance(0);
    scoreBonusRef.current = 0;
    comboRef.current = 1;
    setCombo(1);
    zoneRef.current = 1;
    setZone(1);
    setZoneTint(1);
    nextBossAtRef.current = ZONE_DISTANCE;
    bossIndexRef.current = 0;
    bossActiveRef.current = false;
    setBossActive(false);
    bossEnteringRef.current = false;
    bossHpRef.current = 1;
    bossProjectilesRef.current = [];
    setBossProjectiles([]);
    livesRemainingRef.current = START_LIVES;
    setLivesRemainingState(START_LIVES);
    shieldRef.current = false;
    setShield(false);
    frostedRef.current = false;
    setFrosted(false);
    frostFactorRef.current = 1;
    frostHitsRef.current = 0;
    gestureShieldEnergyRef.current = 100;
    setZoneBanner(null);
    setBossIntensity(false);
  }, []);

  // Ask the server for a short-lived signing token bound to this run.
  const requestRunToken = useCallback((runId: string) => {
    window
      .fetch("/api/score/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.token === "string") {
          leaderboardTokenRef.current = data.token;
        }
      })
      .catch(() => {});
  }, []);

  const completeTutorial = useCallback(() => {
    tutorialSeenRef.current = true;
    Cookies.set("tutorialSeen", "1", { expires: 365 });
    bouldersRef.current = [];
    setBoulders([]);
    powerUpsRef.current = [];
    setPowerUps([]);
    resetForFreshRun();
    requestRunToken(runIdRef.current);
    initJourney();
    countdownStartRef.current = performance.now();
    transitionTo("countdown");
  }, [requestRunToken, transitionTo, resetForFreshRun]);

  const advanceTutorialStep = useCallback(() => {
    const next = tutorialStepRef.current + 1;
    if (next > 3) {
      completeTutorial();
    } else {
      tutorialStepRef.current = next;
      setTutorialStep(next);
      bouldersRef.current = [];
      setBoulders([]);
      powerUpsRef.current = [];
      setPowerUps([]);
    }
  }, [completeTutorial]);

  // Mount-time bootstrap: seed the rocket position, read persisted cookies
  // (high score, tutorial flag, unlocked badges, selected skin) into refs
  // and state once.
  useEffect(() => {
    rocketLeftRef.current = window.innerWidth / 2;
    const rocketEl0 = rocketRef.current;
    if (rocketEl0) {
      rocketEl0.style.left = `${rocketLeftRef.current}px`;
    }
    livesRemainingRef.current = START_LIVES;
    setLivesRemainingState(livesRemainingRef.current);
    reserveLivesRef.current = 0;
    setReserveLives(0);
    highScoreRef.current = parseInt(Cookies.get("highScore") || "0");
    setHighScore(highScoreRef.current);
    setSkinId(readSelectedSkin());
    tutorialSeenRef.current = Cookies.get("tutorialSeen") === "1";
    for (const id of readUnlockedBadges()) {
      unlockedRef.current.add(id);
    }
    setBadges(
      BADGES.map((b) => ({
        id: b.id,
        unlocked: unlockedRef.current.has(b.id),
      }))
    );
  }, []);

  // Keep skinRef in sync with the selected skin (switched only on the idle
  // screen, so the game loop never restarts mid-run).
  useEffect(() => {
    skinRef.current = getSkin(skinId);
  }, [skinId]);

  // Skip the tutorial with a keypress — both hands are busy being tracked
  // for gestures, so Esc (or Space) is the reliable out.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.key === "Escape" || e.key === " ") &&
        gameStateRef.current === "tutorial"
      ) {
        e.preventDefault();
        completeTutorial();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [completeTutorial]);

  // Pause whenever the tab loses focus so the game doesn't run (or the
  // countdown tick away) while the player can't see it.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (
        document.hidden &&
        (gameStateRef.current === "playing" ||
          gameStateRef.current === "countdown")
      ) {
        transitionTo("paused");
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [transitionTo]);

  const retryCamera = useCallback(() => {
    setCameraError(null);
    setCameraRetry((n) => n + 1);
  }, []);

  // Sensitivity is read by the loop via a ref; the slider updates both the
  // React state (HUD label) and the ref (steering math) in one call.
  const changeSensitivity = useCallback((v: number) => {
    setSensitivity(v);
    sensitivityRef.current = v;
  }, []);

  const registerBoulderEl = useCallback(
    (key: string, el: HTMLDivElement | null) => {
      if (el) {
        boulderElsRef.current.set(key, el);
      } else {
        boulderElsRef.current.delete(key);
      }
    },
    []
  );

  const registerParticleEl = useCallback(
    (key: string, el: HTMLDivElement | null) => {
      if (el) {
        particleElsRef.current.set(key, el);
      } else {
        particleElsRef.current.delete(key);
      }
    },
    []
  );

  const registerTiltMarker = useCallback((el: HTMLDivElement | null) => {
    tiltMarkerElRef.current = el;
  }, []);

  const registerBoltEl = useCallback(
    (key: string, el: HTMLDivElement | null) => {
      if (el) {
        boltElsRef.current.set(key, el);
      } else {
        boltElsRef.current.delete(key);
      }
    },
    []
  );

  const setHandResults = (result: any) => {
    setIsLoading(result.isLoading);
    setIsDetected(result.isDetected);
    // Camera errors are cleared by the recognizer once init succeeds — a
    // successful retry must actually leave the error screen (otherwise
    // "Try Again" could never recover after the user grants permission).
    if ("cameraError" in result) {
      setCameraError(result.cameraError ?? null);
    }
    // The recognizer reports low-light only on state CHANGE (1 Hz check), so
    // this setState is change-gated and never churns on every hand frame.
    if ("lowLight" in result) {
      setLowLight(result.lowLight === true);
    }

    // Menu navigation is live on the idle, pause, and game-over screens: a
    // single pointing forefinger drives the cursor and must NOT start or
    // resume a run.
    const menuActive =
      gameStateRef.current === "idle" ||
      gameStateRef.current === "paused" ||
      gameStateRef.current === "gameover";
    const isMenuPoint =
      menuActive &&
      !!result.isPoint &&
      typeof result.pointX === "number" &&
      typeof result.pointY === "number";

    // State machine transitions driven by hand detection.
    if (typeof result.isDetected === "boolean") {
      if (result.isDetected && !isMenuPoint) {
        // Both hands shown: first play runs the tutorial, otherwise the
        // countdown starts (from idle or paused — after a fist-pause the
        // player must lower their hands first, so the still-held fists don't
        // instantly resume the game). Pointing in a menu (or a modal panel
        // being open on idle) defers the start until the player lowers their
        // hands, so navigation never launches a run by accident.
        if (
          !fistPauseLatchRef.current &&
          (gameStateRef.current === "idle" ||
            gameStateRef.current === "paused") &&
          !(gameStateRef.current === "idle" &&
            (leaderboardOpenRef.current || pendingQualifyRef.current))
        ) {
          if (gameStateRef.current === "idle" && !tutorialSeenRef.current) {
            tutorialStepRef.current = 1;
            setTutorialStep(1);
            transitionTo("tutorial");
          } else if (gameStateRef.current === "paused") {
            // Resume the CURRENT run. This must NOT touch any per-run state:
            // wiping stats/runId here silently underreported the game-over
            // totals and invalidated the leaderboard signature (a fresh runId
            // with a token bound to the old one → server 400 reject).
            resumingRef.current = true;
            countdownStartRef.current = performance.now();
            transitionTo("countdown");
          } else {
            // Fresh run from the idle screen: reset every per-run counter.
            resetForFreshRun();
            requestRunToken(runIdRef.current);
            initJourney();
            // Fresh run: reset the shot meter, bolts and pinch latch.
            shootMeterRef.current = 0;
            setShootMeter(0);
            boltsRef.current = [];
            setBolts([]);
            pinchHeldRef.current = false;
            countdownStartRef.current = performance.now();
            transitionTo("countdown");
          }
        }
      } else {
        // Hands left the frame: back to idle mid-countdown/tutorial, or pause
        // mid-game — unless a single hand is still mid-gesture. A lone pinch
        // (fire), flat palm (shield) or spread (dash) must not yank the game
        // to pause; a lone fist still pauses on purpose via the fist handler.
        // pinchHeldRef guards the exact release frame: the state machine
        // runs before the pinch handler, so without it a just-released pinch
        // would pause the game and fireBolt would refuse to shoot.
        const handsFullyDown =
          !result.isPinch &&
          !result.isFlat &&
          !result.isSpread &&
          !result.isFist &&
          !pinchHeldRef.current;
        if (handsFullyDown) {
          if (gameStateRef.current === "countdown") {
            // Dropping hands mid-countdown: a resume returns to the pause
            // menu (the run is still live); a fresh start returns to idle.
            if (resumingRef.current) {
              resumingRef.current = false;
              transitionTo("paused");
            } else {
              transitionTo("idle");
            }
          } else if (gameStateRef.current === "playing") {
            transitionTo("paused");
          } else if (gameStateRef.current === "tutorial") {
            transitionTo("idle");
          }
          // Clear gesture latches so a fresh pose is recognized next time.
          // Only when the hands are fully down — clearing mid-hold would
          // reset a single-hand pinch's charge timer every frame.
          dashHeldRef.current = false;
          fistPauseHeldRef.current = false;
          fistPauseLatchRef.current = false;
          pinchHeldRef.current = false;
        }
      }
    }

    // Pointing hand → menu cursor on the idle/pause/game-over screens. A
    // single pointing forefinger (no palm companion) drives it; camera
    // coords are unmirrored so X is flipped. The MENU_CURSOR_DPI gain
    // pivots on the screen centre so the cursor moves farther than the
    // hand — a small wrist motion sweeps the whole menu.
    if (isMenuPoint) {
      pointLostFramesRef.current = 0;
      const W = window.innerWidth;
      const H = window.innerHeight;
      const rawX = (1 - result.pointX) * W;
      const rawY = result.pointY * H;
      updateMenuCursor(
        Math.max(0, Math.min(W, W / 2 + (rawX - W / 2) * MENU_CURSOR_DPI)),
        Math.max(0, Math.min(H, H / 2 + (rawY - H / 2) * MENU_CURSOR_DPI))
      );
    } else {
      // Grace: the pointing pose flickering off for a frame or two must not
      // blink the cursor or drop its hover highlight — hold it at the last
      // position for a few frames before hiding.
      if (pointLostFramesRef.current < MENU_POINT_LOST_FRAMES) {
        pointLostFramesRef.current += 1;
      } else {
        hideMenuCursor();
      }
    }

    // --- Gesture recognition: debounced edge triggers ---
    const hold = gestureHoldRef.current;
    hold.dash = result.isSpread ? hold.dash + 1 : 0;
    hold.shield = result.isFlat ? hold.shield + 1 : 0;
    // Hold counters decay (off frames subtract 2 instead of hard-resetting)
    // so a single jitter frame mid-gesture can't wipe a nearly-complete
    // pinch/fist — menu clicks and fist-pauses register reliably even when
    // MediaPipe wobbles for one frame. The off-frames guards + click
    // cooldown below still prevent machine-gun clicks.
    hold.fist = result.isFist
      ? Math.min(99, hold.fist + 1)
      : Math.max(0, hold.fist - 2);
    hold.pinch = result.isPinch ? hold.pinch + 1 : 0;
    hold.spread = result.isSpread ? hold.spread + 1 : 0;
    hold.pointPinch = result.pointPinch
      ? Math.min(99, hold.pointPinch + 1)
      : Math.max(0, hold.pointPinch - 2);

    // Spread hands → dash: brief invincibility, burst of speed-line particles
    // and a flash, on a cooldown so it's an escape tool, not a crutch.
    if (hold.dash >= GESTURE_HOLD_FRAMES && !dashHeldRef.current) {
      dashHeldRef.current = true;
      const now = performance.now();
      if (
        gameStateRef.current === "playing" &&
        now >= dashCooldownUntilRef.current
      ) {
        dashUntilRef.current = now + DASH_IFRAMES_MS;
        dashCooldownUntilRef.current = now + DASH_COOLDOWN_MS;
        setIsDashing(true);
        window.setTimeout(() => setIsDashing(false), 300);
        runStatsRef.current.dashes += 1;
        unlockBadge("dash");
        // Dashes charge the shot meter — aggression earns your shots.
        gainShootMeter(SHOOT_METER_PER_DASH);
        playFX();
        const rocket = rocketRef.current?.getBoundingClientRect();
        if (rocket) {
          spawnExplosionRef.current(
            (rocket.left + rocket.right) / 2,
            rocket.top + 10,
            18,
            DASH_COLORS
          );
          spawnScorePopupRef.current(
            (rocket.left + rocket.right) / 2,
            rocket.top - 20,
            "DASH!",
            "#7dd3fc"
          );
        }
      }
    }

    // Flat open palms → energy shield. Activation is debounced; release is
    // immediate so the shield feels responsive to let-go. A drained shield
    // stays off until the player releases and it recharges (no flapping).
    if (
      gameStateRef.current === "playing" &&
      hold.shield >= GESTURE_HOLD_FRAMES &&
      !gestureShieldActiveRef.current &&
      gestureShieldEnergyRef.current > 0
    ) {
      gestureShieldActiveRef.current = true;
    }
    if (!result.isFlat) {
      gestureShieldActiveRef.current = false;
    }

    // Pinch (thumb + index, outer fingers up) → fire a bolt straight up
    // from the rocket. Holding the pinch charges the shot; releasing fires
    // it at the accumulated charge. The edge-trigger + release pattern
    // means a held pinch never machine-guns — every shot is a deliberate
    // squeeze, gated again by the meter and ammo cap inside fireBolt.
    if (hold.pinch >= GESTURE_HOLD_FRAMES && !pinchHeldRef.current) {
      if (gameStateRef.current === "playing") {
        pinchHeldRef.current = true;
        pinchStartRef.current = performance.now();
      }
    }
    if (!result.isPinch && pinchHeldRef.current) {
      pinchHeldRef.current = false;
      const charge = Math.min(
        1,
        Math.max(
          0,
          (performance.now() -
            pinchStartRef.current -
            SHOOT_CHARGE_MS) /
            SHOOT_CHARGE_FULL_MS
        )
      );
      fireBolt(charge);
    }

    // Fists → pause mid-game, skip the first-play tutorial, or CONFIRM in
    // the menus (click whatever button is under the cursor). Edge-triggered;
    // lowering hands is required to re-trigger.
    if (hold.fist >= GESTURE_HOLD_FRAMES && !fistPauseHeldRef.current) {
      fistPauseHeldRef.current = true;
      if (gameStateRef.current === "playing") {
        fistPauseLatchRef.current = true;
        transitionTo("paused");
      } else if (gameStateRef.current === "tutorial") {
        completeTutorial();
      } else if (menuActive) {
        confirmMenu();
      }
    }
    if (!result.isFist) {
      fistPauseHeldRef.current = false;
    }

    // Spread → go back on the menus (close the floating panel).
    if (menuActive && hold.spread >= GESTURE_HOLD_FRAMES && !spreadMenuHeldRef.current) {
      spreadMenuHeldRef.current = true;
      backMenu();
    }
    if (!result.isSpread) {
      spreadMenuHeldRef.current = false;
    }

    // Menu click: pinch the POINTING hand (thumb onto the extended index).
    // Latched on hold, fired on release — like the shoot-pinch, a held
    // pinch never machine-guns clicks. Two extra guards keep a resting
    // thumb from clicking: the pinch must have been cleanly OFF for a few
    // consecutive frames before it can arm again, and each click starts a
    // short cooldown, so threshold flicker can't fire rapid-fire clicks.
    // Count consecutive OFF frames, but RETAIN the count while pinching:
    // a new pinch may only arm if it was preceded by a clean release (the
    // off-frames from before the burst started), so a flickering thumb
    // that never actually lifts can't arm at all.
    if (!result.pointPinch) {
      pointPinchOffFramesRef.current = Math.min(
        99,
        pointPinchOffFramesRef.current + 1
      );
    }
    if (
      menuActive &&
      hold.pointPinch >= GESTURE_HOLD_FRAMES &&
      !menuClickHeldRef.current &&
      pointPinchOffFramesRef.current >= 3 &&
      performance.now() >= pointPinchCooldownUntilRef.current
    ) {
      menuClickHeldRef.current = true;
    }
    if (menuActive && !result.pointPinch && menuClickHeldRef.current) {
      menuClickHeldRef.current = false;
      confirmMenu();
      pointPinchCooldownUntilRef.current = performance.now() + 400;
    }

    // Smooth the raw tilt with an exponential moving average so steering
    // isn't jittery. The first sample seeds the filter; losing detection
    // resets it so re-detection starts fresh instead of lagging behind.
    if (result.isDetected && typeof result.degrees === "number") {
      smoothedDegreesRef.current = hasSmoothedSampleRef.current
        ? smoothedDegreesRef.current +
          TILT_SMOOTHING * (result.degrees - smoothedDegreesRef.current)
        : result.degrees;
      hasSmoothedSampleRef.current = true;
    } else {
      smoothedDegreesRef.current = 0;
      hasSmoothedSampleRef.current = false;
    }

    // Steering itself happens in the rAF loop (position + bank written
    // directly to the DOM), so nothing here triggers a React re-render.
  };


  // Single game loop: zones, boss fights, meteor physics, collisions and
  // scoring all run on requestAnimationFrame using refs. React only mounts/
  // unmounts elements on spawn/despawn — everything moving is mutated
  // directly on the DOM, so nothing re-renders at 60fps.
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let spawnAccumulator = 0;
    let distanceAccumulator = 0;
    // Fractional carry so the 0.9× distance tick stays an integer meter.
    let distanceCarry = 0;
    let invincibleUntil = 0;
    let collidingShown = false;
    let shakeUntil = 0;
    let shakeAmount = 0;
    let wasShaking = false;
    let trailAccumulator = 0;
    let comboUntil = 0;
    let slowmoUntil = 0;
    let doubleUntil = 0;
    let powerUpSpawnTimer = 0;
    let tutorialTiltAccumulator = 0;
    let lastWrittenLeft = -1;
    let lastWrittenRot = "";
    let frostUntil = 0;

    const explosionColors = ["#f87171", "#fbbf24", "#f97316", "#ffffff"];
    // Element-themed debris palettes so each guardian's hits burst with the
    // right material — stone, ember, ice or void — instead of generic fire.
    const ICE_PALETTE = ["#e0f2fe", "#bae6fd", "#67e8f9", "#ffffff"];
    const EMBER_PALETTE = ["#fde047", "#f97316", "#b91c1c", "#1c1917"];
    const STONE_PALETTE = ["#a8a29e", "#78716c", "#57534e", "#292524"];
    const VOID_PALETTE = ["#c4b5fd", "#8b5cf6", "#4c1d95", "#1e1b4b"];

    const pushParticles = (burst: ParticleData[]) => {
      particlesRef.current = [...particlesRef.current, ...burst].slice(
        -MAX_PARTICLES
      );
      setParticles(particlesRef.current);
    };

    // Generic radial burst (meteor impacts, power-up pickups, boss death).
    // Debris now carries gravity so every explosion reads as material
    // falling, not a weightless firework.
    const spawnExplosion = (
      x: number,
      y: number,
      count: number,
      colors: string[] = explosionColors,
      shape: "circle" | "shard" = "circle"
    ) => {
      const burst: ParticleData[] = [];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 150;
        const life = 0.45 + Math.random() * 0.55;
        burst.push({
          key: `p-${Date.now()}-${Math.random()}`,
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 2 + Math.random() * 5,
          life,
          maxLife: life,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 540,
          gravity: 300,
          shape,
        });
      }
      pushParticles(burst);
    };

    // Layered crash burst for when the rocket itself takes a hit: an
    // expanding shockwave ring, a white-hot flash, fire + falling debris,
    // heavy tumbling chunks, and slow smoke that billows upward — so an
    // impact looks like an impact, not a puff of dots.
    const spawnCrashExplosion = (x: number, y: number, colors: string[]) => {
      const burst: ParticleData[] = [];
      const key = () => `p-${Date.now()}-${Math.random()}`;
      // Expanding shockwave rings (fast white, then slower amber).
      burst.push({
        key: key(),
        x,
        y,
        vx: 0,
        vy: 0,
        size: 8,
        growth: 560,
        life: 0.3,
        maxLife: 0.3,
        color: "rgba(255,255,255,0.9)",
        rotation: 0,
        rotSpeed: 0,
        ring: true,
      });
      burst.push({
        key: key(),
        x,
        y,
        vx: 0,
        vy: 0,
        size: 5,
        growth: 360,
        life: 0.5,
        maxLife: 0.5,
        color: "rgba(251,146,60,0.85)",
        rotation: 0,
        rotSpeed: 0,
        ring: true,
      });
      // White-hot flash core — fast, tiny, gone in a quarter second.
      for (let i = 0; i < 10; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 110 + Math.random() * 170;
        const life = 0.18 + Math.random() * 0.18;
        burst.push({
          key: key(),
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 1.5 + Math.random() * 2,
          life,
          maxLife: life,
          color: Math.random() < 0.5 ? "#ffffff" : "#fef3c7",
          rotation: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 700,
        });
      }
      // Fire + debris in the palette, arcing down under gravity.
      for (let i = 0; i < 16; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 45 + Math.random() * 160;
        const life = 0.4 + Math.random() * 0.5;
        burst.push({
          key: key(),
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 2 + Math.random() * 4,
          life,
          maxLife: life,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 540,
          gravity: 320,
        });
      }
      // Heavy chunks, biased downward, tumbling as they fall.
      for (let i = 0; i < 7; i++) {
        const life = 0.8 + Math.random() * 0.5;
        const pick = [
          colors[Math.floor(Math.random() * colors.length)],
          STONE_PALETTE[Math.floor(Math.random() * STONE_PALETTE.length)],
        ];
        burst.push({
          key: key(),
          x,
          y,
          vx: (Math.random() - 0.5) * 130,
          vy: 20 + Math.random() * 95,
          size: 4 + Math.random() * 5,
          life,
          maxLife: life,
          color: pick[Math.floor(Math.random() * pick.length)],
          rotation: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 420,
          gravity: 430,
        });
      }
      // Smoke billows up, expanding as it fades.
      for (let i = 0; i < 6; i++) {
        const life = 1.1 + Math.random() * 0.6;
        burst.push({
          key: key(),
          x: x + (Math.random() - 0.5) * 24,
          y,
          vx: (Math.random() - 0.5) * 42,
          vy: -18 - Math.random() * 30,
          size: 4 + Math.random() * 3,
          life,
          maxLife: life,
          color: "rgba(160,160,175,0.4)",
          growth: 18 + Math.random() * 12,
          rotation: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 70,
          gravity: -45,
        });
      }
      pushParticles(burst);
    };

    // Engine plume: three flame layers per tick (white-hot core, the skin's
    // flame mid, a cooler ember outer) that expand as they fall, plus the
    // occasional gray exhaust smoke puff trailing behind.
    const emitTrailParticle = (rocket: DOMRect) => {
      const cx = (rocket.left + rocket.right) / 2;
      const cy = rocket.bottom - 2;
      const flame = skinRef.current.flame;
      const burst: ParticleData[] = [];
      const key = () => `p-${Date.now()}-${Math.random()}`;
      // White-hot core streak.
      burst.push({
        key: key(),
        x: cx + (Math.random() - 0.5) * 4,
        y: cy,
        vx: (Math.random() - 0.5) * 18,
        vy: 95 + Math.random() * 65,
        size: 1.5 + Math.random() * 1.5,
        life: 0.2,
        maxLife: 0.2,
        color: "#ffffff",
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 500,
      });
      // Mid flame layer (skin color), expanding as it falls away.
      burst.push({
        key: key(),
        x: cx + (Math.random() - 0.5) * 6,
        y: cy,
        vx: (Math.random() - 0.5) * 30,
        vy: 50 + Math.random() * 60,
        size: 2.5 + Math.random() * 2,
        life: 0.4 + Math.random() * 0.25,
        maxLife: 0.4 + Math.random() * 0.25,
        color: flame,
        growth: 13 + Math.random() * 9,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 300,
      });
      // Cooler outer ember — slower, bigger, lingers longest.
      burst.push({
        key: key(),
        x: cx + (Math.random() - 0.5) * 9,
        y: cy,
        vx: (Math.random() - 0.5) * 48,
        vy: 28 + Math.random() * 42,
        size: 3 + Math.random() * 2.5,
        life: 0.55 + Math.random() * 0.3,
        maxLife: 0.55 + Math.random() * 0.3,
        color: shadeFlame(flame, -0.4),
        growth: 17 + Math.random() * 11,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 220,
      });
      // Occasional exhaust smoke.
      if (Math.random() < 0.35) {
        burst.push({
          key: key(),
          x: cx + (Math.random() - 0.5) * 10,
          y: cy - 2,
          vx: (Math.random() - 0.5) * 34,
          vy: 10 + Math.random() * 20,
          size: 3.5 + Math.random() * 2,
          life: 0.9 + Math.random() * 0.5,
          maxLife: 0.9 + Math.random() * 0.5,
          color: "rgba(150,150,165,0.4)",
          growth: 15 + Math.random() * 10,
          rotation: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 80,
        });
      }
      pushParticles(burst);
    };

    const spawnScorePopup = (
      x: number,
      y: number,
      text: string,
      color = "#fde047"
    ) => {
      scorePopupsRef.current = [
        ...scorePopupsRef.current,
        {
          key: `sp-${Date.now()}-${Math.random()}`,
          x,
          y,
          text,
          life: 0.9,
          maxLife: 0.9,
          color,
        },
      ].slice(-12);
      setScorePopups(scorePopupsRef.current);
    };

    // Expose these to setHandResults (dash burst / popups) via ref bridges.
    spawnExplosionRef.current = spawnExplosion;
    spawnScorePopupRef.current = spawnScorePopup;

    const checkHighScore = () => {
      const total = distanceRef.current + scoreBonusRef.current;
      if (total > highScoreRef.current) {
        highScoreRef.current = total;
        Cookies.set("highScore", total.toString(), { expires: 365 });
        setHighScore(total);
      }
    };

    const spawnPowerUp = () => {
      const types: PowerUpType[] = ["shield", "slowmo", "double", "life"];
      const type = types[Math.floor(Math.random() * types.length)];
      const size = Math.round(34 * spriteScale());
      const speed = fallSpeed(distanceRef.current) * 0.8;
      powerUpsRef.current = [
        ...powerUpsRef.current,
        {
          key: `pu-${Date.now()}-${Math.random()}`,
          x: Math.random() * (window.innerWidth - size),
          y: -60,
          size,
          speed,
          rotation: Math.random() * 360,
          type,
          hit: false,
        },
      ];
      setPowerUps(powerUpsRef.current);
    };

    const applyPowerUp = (
      now: number,
      x: number,
      y: number,
      type: PowerUpType
    ) => {
      const multiplier = now < doubleUntil ? 2 : 1;
      const points = powerUpPoints(multiplier === 2);
      scoreBonusRef.current += points;
      checkHighScore();
      if (type === "life") {
        // The heart shows its life outcome instead of the generic point value:
        // an active life, a banked reserve life, or a full cap.
        let lifeMsg = "Lives Full";
        if (livesRemainingRef.current < START_LIVES) {
          lifeMsg = "+1 Life";
        } else if (reserveLivesRef.current < RESERVE_LIVES_MAX) {
          lifeMsg = "+1 Reserve";
        }
        spawnScorePopup(x, y - 8, lifeMsg, POWER_UP_COLORS.life);
      } else {
        spawnScorePopup(x, y - 8, `+${points}`, POWER_UP_COLORS[type]);
      }
      spawnExplosion(x, y, 14);
      runStatsRef.current.powerUps += 1;
      switch (type) {
        case "shield":
          shieldRef.current = true;
          setShield(true);
          unlockBadge("shield");
          break;
        case "slowmo":
          slowmoUntil = now + SLOWMO_DURATION_MS;
          break;
        case "double":
          doubleUntil = now + DOUBLE_DURATION_MS;
          break;
        case "life":
          if (livesRemainingRef.current < START_LIVES) {
            livesRemainingRef.current += 1;
            setLivesRemainingState(livesRemainingRef.current);
          } else if (reserveLivesRef.current < RESERVE_LIVES_MAX) {
            // Lives are full — bank the heart so it isn't wasted.
            reserveLivesRef.current += 1;
            setReserveLives(reserveLivesRef.current);
          }
          break;
      }
    };

    const showBanner = (banner: Banner) => {
      setZoneBanner(banner);
      if (bannerTimeoutRef.current !== null) {
        window.clearTimeout(bannerTimeoutRef.current);
      }
      bannerTimeoutRef.current = window.setTimeout(() => {
        setZoneBanner(null);
        bannerTimeoutRef.current = null;
      }, 2600);
    };

    // Shared shield absorption for any hit (meteor, boss shot, frost shard).
    // Returns true when a shield absorbed the hit.
    const consumeShield = (now: number, hitX: number, hitY: number) => {
      if (shieldRef.current) {
        shieldRef.current = false;
        setShield(false);
        invincibleUntil = now + 300;
        playFX();
        spawnExplosion(hitX, hitY, 24);
        spawnScorePopup(hitX, hitY - 10, "Shield down", "#38bdf8");
        runStatsRef.current.shields += 1;
        return true;
      }
      // Gesture shield: absorbs a hit while held, burning a chunk of energy.
      // A nearly-drained shield lets the hit through — release and recharge.
      if (
        gestureShieldActiveRef.current &&
        gestureShieldEnergyRef.current >= SHIELD_BLOCK_ENERGY
      ) {
        gestureShieldEnergyRef.current -= SHIELD_BLOCK_ENERGY;
        playFX();
        spawnExplosion(hitX, hitY, 20);
        spawnScorePopup(hitX, hitY - 10, "Blocked!", "#38bdf8");
        runStatsRef.current.shields += 1;
        return true;
      }
      return false;
    };

    // Shared consequences of the rocket being hit (meteor or boss shot).
    // The optional palette themes the debris burst by what hit you.
    const handleHit = (
      now: number,
      hitX: number,
      hitY: number,
      colors: string[] = explosionColors
    ) => {
      if (consumeShield(now, hitX, hitY)) return;
      // Any life-affecting hit resets the freeze counter, so a rock hit
      // between shards means the frost pair starts over.
      frostHitsRef.current = 0;
      comboRef.current = 1;
      setCombo(1);
      invincibleUntil = now + INVINCIBILITY_MS;
      playFX();
      shakeUntil = now + SHAKE_DURATION_MS;
      shakeAmount = SHAKE_AMOUNT;
      spawnCrashExplosion(hitX, hitY, colors);
      if (reserveLivesRef.current > 0) {
        // A banked reserve absorbs the hit — no active life is lost.
        reserveLivesRef.current -= 1;
        setReserveLives(reserveLivesRef.current);
        spawnScorePopup(hitX, hitY - 26, "Reserve!", "#fda4af");
        return;
      }
      livesRemainingRef.current -= 1;
      setLivesRemainingState(livesRemainingRef.current);
      if (livesRemainingRef.current <= 0) {
        // Record how far the run got in the zone it fell in.
        const lastZone = journeyRef.current[journeyRef.current.length - 1];
        if (lastZone) {
          lastZone.distanceAt = distanceRef.current;
        }
        setGameOverStats({
          score: distanceRef.current + scoreBonusRef.current,
          maxCombo: runStatsRef.current.maxCombo,
          grazes: runStatsRef.current.grazes,
          powerUps: runStatsRef.current.powerUps,
          dashes: runStatsRef.current.dashes,
          shields: runStatsRef.current.shields,
          bosses: runStatsRef.current.bosses,
          journey: [...journeyRef.current],
          finalObjective: getZoneStory(zoneRef.current).objective,
        });
        // Clear all in-flight debris so nothing frozen lingers behind the
        // game-over panel (boss, meteors, particles, popups, power-ups).
        bossActiveRef.current = false;
        setBossActive(false);
        bossProjectilesRef.current = [];
        setBossProjectiles([]);
        bouldersRef.current = [];
        setBoulders([]);
        particlesRef.current = [];
        setParticles([]);
        powerUpsRef.current = [];
        setPowerUps([]);
        boltsRef.current = [];
        setBolts([]);
        scorePopupsRef.current = [];
        setScorePopups([]);
        // Drop any pending zone banners so nothing lingers over the panel.
        if (bannerTimeoutRef.current !== null) {
          window.clearTimeout(bannerTimeoutRef.current);
          bannerTimeoutRef.current = null;
        }
        if (pendingBannerRef.current !== null) {
          window.clearTimeout(pendingBannerRef.current);
          pendingBannerRef.current = null;
        }
        setZoneBanner(null);
        setBossIntensity(false);
        transitionTo("gameover");
        // A run only enters the leaderboard if it cracks the top-10 — and
        // only after the player confirms their callsign. Ask first, post on
        // confirm (the name prompt lives on the game-over screen).
        if (!runIdRef.current) runIdRef.current = crypto.randomUUID();
        pendingRunRef.current = {
          runId: runIdRef.current,
          score: distanceRef.current + scoreBonusRef.current,
          distance: distanceRef.current,
          zone: zoneRef.current,
          maxCombo: runStatsRef.current.maxCombo,
          grazes: runStatsRef.current.grazes,
          powerUps: runStatsRef.current.powerUps,
          bosses: runStatsRef.current.bosses,
          durationMs: Math.round(performance.now() - runStartTimeRef.current),
        };
        const pendingScore = pendingRunRef.current.score as number;
        window
          .fetch("/api/score/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ score: pendingScore }),
          })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (
              data &&
              data.qualifies &&
              typeof data.rank === "number"
            ) {
              setPendingQualify({ rank: data.rank });
            }
          })
          .catch(() => {});
      }
    };

    const startBoss = (now: number) => {
      bossActiveRef.current = true;
      setBossActive(true);
      bossEnteringRef.current = true;
      bossEntranceElapsedRef.current = 0;
      setBossBarVisible(false);
      setBossFlash(false);
      bossHpRef.current = 1;
      bossFireTimerRef.current = 0;
      bossVolleyRef.current = 0;
      bossBaseXRef.current = window.innerWidth / 2 - 70 * spriteScale();
      bouldersRef.current = [];
      setBoulders([]);
      particlesRef.current = [];
      setParticles([]);
      bossProjectilesRef.current = [];
      setBossProjectiles([]);
      powerUpsRef.current = [];
      setPowerUps([]);
      if (bossBarFillRef.current) {
        bossBarFillRef.current.style.width = "100%";
      }
      distanceAccumulator = 0;
      setBossIntensity(true);
      showBanner({
        title: "⚠ BOSS",
        subtitle: `${getZone(zoneRef.current).name} Guardian`,
      });
    };

    const defeatBoss = () => {
      bossActiveRef.current = false;
      setBossActive(false);
      bossProjectilesRef.current = [];
      setBossProjectiles([]);
      // The guardian's death burst matches its material: the asteroid
      // guardian shatters into stone chunks, the others into generic fire.
      const zoneIdx = (zoneRef.current - 1) % ZONE_THEMES.length;
      spawnExplosion(
        bossBaseXRef.current + 70,
        160,
        zoneIdx === 0 ? 42 : 36,
        zoneIdx === 0 ? STONE_PALETTE : explosionColors
      );
      const clearedZone = zoneRef.current;
      const nextZone = zoneRef.current + 1;
      // Chapter reward for clearing the zone, plus the journey log advance.
      const bonus = bossClearBonus();
      scoreBonusRef.current += bonus;
      checkHighScore();
      spawnScorePopup(bossBaseXRef.current + 70, 200, `+${bonus}`, "#34d399");
      const zoneEntry = journeyRef.current[journeyRef.current.length - 1];
      if (zoneEntry) {
        zoneEntry.cleared = true;
      }
      journeyRef.current = [
        ...journeyRef.current,
        {
          zone: nextZone,
          name: getZone(nextZone).name,
          cleared: false,
          distanceAt: distanceRef.current,
          bestCombo: 1,
        },
      ];
      zoneRef.current = nextZone;
      setZone(nextZone);
      setZoneTint(nextZone);
      setBossIntensity(false);
      bossIndexRef.current += 1;
      nextBossAtRef.current += ZONE_DISTANCE;
      runStatsRef.current.bosses += 1;
      unlockBadge("boss");
      // Celebration banner, then a queued mission brief for the next chapter.
      showBanner({
        title: `✓ Zone ${clearedZone} Cleared`,
        subtitle: `+${bonus} bonus • ${getZoneStory(nextZone).chapter} ahead`,
        variant: "clear",
      });
      pendingBannerRef.current = window.setTimeout(() => {
        pendingBannerRef.current = null;
        showBanner({
          title: `Zone ${nextZone} — ${getZone(nextZone).name}`,
          subtitle: getZoneStory(nextZone).chapter,
          objective: getZoneStory(nextZone).objective,
          variant: "zone",
        });
      }, 2100);
    };

    const updateBoss = (
      now: number,
      dt: number,
      rocket: DOMRect | undefined,
      invincible: boolean,
      slowmoFactor: number
    ) => {
      const viewportHeight = window.innerHeight;
      // Which guardian this is (asteroid, nebula, ice, lava, void).
      const zoneIdx = (zoneRef.current - 1) % ZONE_THEMES.length;

      // Slow sway across the top of the screen. Bruiser guardians (asteroid
      // and lava) drift wider and the lava one faster, so their volleys come
      // from more positions and demand more active tracking.
      const tuning = BOSS_TUNING[zoneIdx] ?? BOSS_TUNING[0];
      const bossX =
        bossBaseXRef.current +
        Math.sin(now / (900 / tuning.swaySpeed)) *
          window.innerWidth *
          0.18 *
          tuning.swayWidth;

      // Entrance: the guardian drops in from above with an eased fall, then
      // slams into place — shake + flash + health bar reveal. No firing or
      // health drain until it lands.
      const BOSS_ENTRANCE_MS = 0.9;
      if (bossEnteringRef.current) {
        bossEntranceElapsedRef.current += dt;
        const t = Math.min(1, bossEntranceElapsedRef.current / BOSS_ENTRANCE_MS);
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic: heavy fall
        const y = -260 + 350 * eased; // -260 (above screen) → 90
        bossRef.current?.style.setProperty(
          "transform",
          `translate3d(${bossX}px, ${y}px, 0)`
        );
        if (t >= 1) {
          bossEnteringRef.current = false;
          shakeUntil = now + SHAKE_DURATION_MS;
          shakeAmount = SHAKE_AMOUNT * 1.7;
          setBossFlash(true);
          window.setTimeout(() => setBossFlash(false), 500);
          setBossBarVisible(true);
        }
        return;
      }

      bossRef.current?.style.setProperty(
        "transform",
        `translate3d(${bossX}px, 90px, 0)`
      );

      // Health drains while the player survives the barrage — scaled by the
      // guardian's own HP multiplier, so bruisers outlast the rest.
      bossHpRef.current = Math.max(
        0,
        bossHpRef.current -
          dt / (bossDuration(bossIndexRef.current) * tuning.hp)
      );
      if (bossBarFillRef.current) {
        bossBarFillRef.current.style.width = `${(
          bossHpRef.current * 100
        ).toFixed(1)}%`;
      }

      // Each zone's guardian has its own signature attack.
      const originX = bossX + 70;
      const originY = 160;
      const addProjectile = (
        x: number,
        y: number,
        vx: number,
        vy: number,
        size: number,
        kind: BossProjectile["kind"],
        gravity = 0
      ) => {
        bossProjectilesRef.current = [
          ...bossProjectilesRef.current,
          {
            key: `bp-${Date.now()}-${Math.random()}`,
            x,
            y,
            vx,
            vy,
            size,
            hit: false,
            kind,
            gravity,
          },
        ];
        setBossProjectiles(bossProjectilesRef.current);
      };

      const rockLobber = () => {
        // Asteroid Field: the guardian solves a true ballistic arc for each
        // of the three rocks — velocity chosen so the gravity-affected rock
        // lands on the rocket's current position. Small aim jitter keeps the
        // volley dodgeable, but standing still means taking all three.
        const targetX = rocket ? (rocket.left + rocket.right) / 2 : originX;
        const targetY = rocket ? (rocket.top + rocket.bottom) / 2 : 420;
        const g = 150 + bossIndexRef.current * 6;
        for (let i = 0; i < 3; i++) {
          // Flight time doubles the previous pass (1.25–1.55s → 2.5–3.1s),
          // halving the rocks' speed: they still arc onto the rocket's
          // position, but drift slowly enough to read and react to.
          const t = 2.5 + Math.random() * 0.6; // per-rock flight time
          const aimX = targetX + (Math.random() * 70 - 35);
          addProjectile(
            originX,
            originY,
            (aimX - originX) / t,
            (targetY - originY) / t - 0.5 * g * t,
            24 + Math.random() * 8,
            "rock",
            g
          );
        }
      };

      const debrisRing = () => {
        // Asteroid Field, alternating volleys: the guardian cracks and sheds
        // a radial burst of rock fragments. Light gravity arcs them down, so
        // the player has to dodge both the falling shrapnel and the lobs.
        const count = 7;
        const speed = 150 + bossIndexRef.current * 8;
        for (let i = 0; i < count; i++) {
          const a = (Math.PI * 2 * i) / count + Math.random() * 0.22;
          addProjectile(
            originX,
            originY,
            Math.cos(a) * speed,
            Math.sin(a) * speed,
            11 + Math.random() * 6,
            "rock",
            60
          );
        }
      };

      const plasmaRing = () => {
        // Nebula Storm: an expanding ring of plasma bolts.
        const count = 12 + Math.min(6, bossIndexRef.current);
        const speed = 140 + bossIndexRef.current * 8;
        for (let i = 0; i < count; i++) {
          const a = (Math.PI * 2 * i) / count;
          addProjectile(
            originX,
            originY,
            Math.cos(a) * speed,
            Math.sin(a) * speed,
            9,
            "bolt"
          );
        }
      };

      const frostShards = () => {
        // Ice Field: a cone of shards that frost your steering on hit.
        const targetX = rocket ? (rocket.left + rocket.right) / 2 : originX;
        const targetY = rocket ? (rocket.top + rocket.bottom) / 2 : 500;
        const baseAim = Math.atan2(targetX - originX, targetY - originY);
        const speed = 200 + bossIndexRef.current * 10;
        for (let i = -2; i <= 2; i++) {
          const a = baseAim + i * 0.17;
          addProjectile(
            originX,
            originY,
            Math.sin(a) * speed,
            Math.cos(a) * speed,
            15 * spriteScale(),
            "shard"
          );
        }
      };

      const emberRain = () => {
        // Lava Belt: burning rocks fall from above at random positions.
        const speed = 165 + bossIndexRef.current * 8;
        for (let i = 0; i < 3; i++) {
          addProjectile(
            Math.random() * (window.innerWidth - 60),
            -40,
            0,
            speed,
            26 * spriteScale(),
            "lava",
            60
          );
        }
      };

      const moltenSpit = () => {
        // Lava Belt, alternating volleys: a tight stream of fireballs aimed
        // straight at the rocket — the rain alone is dodgeable by staying
        // put, so the spit forces an active dodge.
        const targetX = rocket ? (rocket.left + rocket.right) / 2 : originX;
        const targetY = rocket ? (rocket.top + rocket.bottom) / 2 : 500;
        const baseAim = Math.atan2(targetX - originX, targetY - originY);
        const speed = 215 + bossIndexRef.current * 8;
        for (let i = -1; i <= 1; i++) {
          const a = baseAim + i * 0.14;
          addProjectile(
            originX,
            originY,
            Math.sin(a) * speed,
            Math.cos(a) * speed,
            15 * spriteScale(),
            "lava"
          );
        }
      };

      const warpOrbs = () => {
        // The Void: slow orbs that home in on the rocket.
        const speed = 120 + bossIndexRef.current * 6;
        for (let i = 0; i < 2; i++) {
          addProjectile(
            originX + (Math.random() * 90 - 45),
            originY,
            (Math.random() - 0.5) * 70,
            speed,
            16 * spriteScale(),
            "orb"
          );
        }
      };

      bossFireTimerRef.current += dt;
      if (bossFireTimerRef.current >= tuning.interval) {
        bossFireTimerRef.current -= tuning.interval;
        bossVolleyRef.current += 1;
        switch (zoneIdx) {
          case 0:
            // Bruiser: alternates heavy lobs with radial debris bursts.
            if (bossVolleyRef.current % 2 === 0) {
              debrisRing();
            } else {
              rockLobber();
            }
            break;
          case 1:
            plasmaRing();
            break;
          case 2:
            frostShards();
            break;
          case 3:
            // Bruiser: alternates the random ember rain with an aimed spit.
            if (bossVolleyRef.current % 2 === 0) {
              moltenSpit();
            } else {
              emberRain();
            }
            break;
          case 4:
            warpOrbs();
            break;
        }
      }

      // Move, collide and despawn projectiles.
      let changed = false;
      const remaining: BossProjectile[] = [];
      for (const p of bossProjectilesRef.current) {
        // Lava/rock lobs accelerate downward; void orbs home toward the rocket.
        if (p.gravity) {
          p.vy += p.gravity * dt;
        }
        if (p.kind === "orb" && rocket) {
          const cx = (rocket.left + rocket.right) / 2;
          const cy = (rocket.top + rocket.bottom) / 2;
          const d = Math.hypot(cx - p.x, cy - p.y) || 1;
          p.vx += ((cx - p.x) / d) * 300 * dt;
          p.vy += ((cy - p.y) / d) * 300 * dt;
          const sp = Math.hypot(p.vx, p.vy);
          const max = 200;
          if (sp > max) {
            p.vx = (p.vx / sp) * max;
            p.vy = (p.vy / sp) * max;
          }
        }
        p.x += p.vx * slowmoFactor * dt;
        p.y += p.vy * slowmoFactor * dt;
        const el = bossProjectileElsRef.current.get(p.key);
        if (el) {
          el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
        }
        if (
          p.y > viewportHeight + p.size ||
          p.x < -60 ||
          p.x > window.innerWidth + 60
        ) {
          changed = true;
          continue;
        }
        if (rocket && !p.hit && !invincible) {
          const box = {
            left: p.x + 3,
            right: p.x + p.size - 3,
            top: p.y + 3,
            bottom: p.y + p.size - 3,
          };
          if (
            box.left < rocket.right &&
            box.right > rocket.left &&
            box.top < rocket.bottom &&
            box.bottom > rocket.top
          ) {
            p.hit = true;
            changed = true;
            if (p.kind === "shard") {
              // Ice shards frost your steering AND build freeze: every
              // unshielded hit chills, and the second one freezes the hull
              // solid — a frosty crash that costs a life. A shield absorbs
              // the hit entirely, including the freeze counter.
              if (!consumeShield(now, p.x + p.size / 2, p.y + p.size / 2)) {
                frostUntil = now + FROST_MS;
                if (!frostedRef.current) {
                  frostedRef.current = true;
                  setFrosted(true);
                }
                frostHitsRef.current += 1;
                if (frostHitsRef.current >= FROST_HITS_TO_LIFE) {
                  frostHitsRef.current = 0;
                  handleHit(
                    now,
                    p.x + p.size / 2,
                    p.y + p.size / 2,
                    ICE_PALETTE
                  );
                  spawnScorePopup(
                    p.x + p.size / 2,
                    p.y + p.size / 2 - 26,
                    "FROZEN SOLID!",
                    "#a5f3fc"
                  );
                } else {
                  playFX();
                  spawnExplosion(
                    p.x + p.size / 2,
                    p.y + p.size / 2,
                    12,
                    ICE_PALETTE,
                    "shard"
                  );
                  spawnScorePopup(
                    p.x + p.size / 2,
                    p.y + p.size / 2 - 12,
                    "FROSTED!",
                    "#67e8f9"
                  );
                }
              }
            } else {
              const palette =
                p.kind === "rock"
                  ? STONE_PALETTE
                  : p.kind === "lava"
                    ? EMBER_PALETTE
                    : p.kind === "orb"
                      ? VOID_PALETTE
                      : undefined;
              handleHit(now, p.x + p.size / 2, p.y + p.size / 2, palette);
            }
            continue;
          }
        }
        remaining.push(p);
      }
      if (changed) {
        bossProjectilesRef.current = remaining;
        setBossProjectiles(remaining);
      }

      if (bossHpRef.current <= 0) {
        defeatBoss();
      }
    };

    // First-play tutorial: three interactive lessons driven by the same loop
    // (a live tilt meter, a demo meteor to graze, a demo power-up to grab).
    // No lives are at stake — overlaps just flash and teach.
    const updateTutorial = (
      now: number,
      dt: number,
      rocket: DOMRect | undefined
    ) => {
      const step = tutorialStepRef.current;

      if (step === 1) {
        // Move the meter marker live with the smoothed tilt; require a
        // sustained tilt before advancing so the player feels the control.
        const tilt = smoothedDegreesRef.current;
        if (Math.abs(tilt) > 8) {
          tutorialTiltAccumulator += dt;
        } else {
          tutorialTiltAccumulator = Math.max(
            0,
            tutorialTiltAccumulator - dt * 2
          );
        }
        if (tiltMarkerElRef.current) {
          const pct = Math.max(-1, Math.min(1, tilt / 30));
          tiltMarkerElRef.current.style.transform = `translateX(${(
            pct * 80
          ).toFixed(1)}px)`;
        }
        if (tutorialTiltAccumulator > 0.6) {
          advanceTutorialStep();
        }
        return;
      }

      if (step === 2) {
        // A single slow meteor to graze; respawns if it sails past.
        if (bouldersRef.current.length === 0) {
          // Spawn below the tutorial card so the demo is always visible.
          const demoTop = Math.max(300, window.innerHeight * 0.44);
          bouldersRef.current = [
            {
              key: `tut-${Date.now()}`,
              x: window.innerWidth / 2 - 35 + (Math.random() * 100 - 50),
              y: demoTop,
              size: 70,
              rotation: 20,
              speed: 130,
              hit: false,
              grazed: false,
              variant: 0,
            },
          ];
          setBoulders(bouldersRef.current);
        }
        const b = bouldersRef.current[0];
        b.y += b.speed * dt;
        const el = boulderElsRef.current.get(b.key);
        if (el) {
          el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0) rotate(${b.rotation}deg)`;
        }
        if (rocket) {
          const inset = COLLISION_INSET * spriteScale();
          const boulderBox = {
            left: b.x + inset,
            right: b.x + b.size - inset,
            top: b.y + inset,
            bottom: b.y + b.size - inset,
          };
          const overlapping =
            boulderBox.left < rocket.right &&
            boulderBox.right > rocket.left &&
            boulderBox.top < rocket.bottom &&
            boulderBox.bottom > rocket.top;
          const dist = Math.hypot(
            b.x + b.size / 2 - (rocket.left + rocket.right) / 2,
            b.y + b.size / 2 - (rocket.top + rocket.bottom) / 2
          );
          if (
            !b.grazed &&
            !overlapping &&
            dist < GRAZE_RADIUS * gameplayScale() + b.size / 2
          ) {
            b.grazed = true;
            spawnScorePopup(
              b.x + b.size / 2,
              b.y + b.size / 2 - 12,
              "+9 Graze!",
              "#fde047"
            );
            advanceTutorialStep();
          } else if (overlapping && !b.hit) {
            // Flash the hit border as a lesson — no life is lost in the
            // tutorial.
            b.hit = true;
            invincibleUntil = now + 250;
            spawnScorePopup(
              b.x + b.size / 2,
              b.y + b.size / 2,
              "Ouch — avoid!",
              "#f87171"
            );
          }
        }
        if (b.y > window.innerHeight + 100) {
          bouldersRef.current = [];
          setBoulders([]);
        }
        return;
      }

      if (step === 3) {
        // A swaying power-up to steer into; respawns if it drifts past.
        if (powerUpsRef.current.length === 0) {
          const size = 34;
          const demoTop = Math.max(300, window.innerHeight * 0.44);
          powerUpsRef.current = [
            {
              key: `tutpu-${Date.now()}`,
              x: window.innerWidth / 2 - size / 2 - 90,
              y: demoTop,
              size,
              speed: 110,
              rotation: 0,
              type: "shield",
              hit: false,
            },
          ];
          setPowerUps(powerUpsRef.current);
        }
        const p = powerUpsRef.current[0];
        p.y += p.speed * dt;
        p.x += Math.sin(now / 700) * 40 * dt;
        p.rotation += 90 * dt;
        const pEl = powerUpElsRef.current.get(p.key);
        if (pEl) {
          pEl.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rotation}deg)`;
        }
        if (rocket && !p.hit) {
          const box = {
            left: p.x + 4,
            right: p.x + p.size - 4,
            top: p.y + 4,
            bottom: p.y + p.size - 4,
          };
          if (
            box.left < rocket.right &&
            box.right > rocket.left &&
            box.top < rocket.bottom &&
            box.bottom > rocket.top
          ) {
            p.hit = true;
            spawnScorePopup(
              p.x + p.size / 2,
              p.y - 8,
              "Power-up!",
              POWER_UP_COLORS[p.type]
            );
            advanceTutorialStep();
          }
        }
        if (p.y > window.innerHeight + 100) {
          powerUpsRef.current = [];
          setPowerUps([]);
        }
      }
    };

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05); // clamp tab-switch jumps
      lastTime = now;

      // Decaying screen shake after an impact (settles even if paused).
      if (now < shakeUntil) {
        const remaining = (shakeUntil - now) / SHAKE_DURATION_MS;
        const intensity = shakeAmount * remaining;
        const ox = (Math.random() * 2 - 1) * intensity;
        const oy = (Math.random() * 2 - 1) * intensity;
        shakeWrapperRef.current?.style.setProperty(
          "transform",
          `translate(${ox.toFixed(2)}px, ${oy.toFixed(2)}px)`
        );
        wasShaking = true;
      } else if (wasShaking) {
        wasShaking = false;
        shakeWrapperRef.current?.style.removeProperty("transform");
      }

      // Starfield drifts faster as distance grows; frozen when not playing
      // (and slowed during slow-mo).
      starfieldSpeedRef.current =
        gameStateRef.current === "playing"
          ? Math.min(3, 1 + distanceRef.current / 1500) *
            (now < slowmoUntil ? SLOWMO_FACTOR : 1)
          : 0;

      // Rocket follows the smoothed tilt — position and bank are written
      // straight to the DOM (never React state), so hand-tracking frames
      // don't re-render the page. Steering is gated to play/tutorial (the
      // countdown/pause lock from before is preserved) and scaled at the old
      // ~30Hz hand-frame rate, so the feel is unchanged.
      const rocketEl = rocketRef.current;
      if (rocketEl) {
        const steerable =
          gameStateRef.current === "playing" ||
          gameStateRef.current === "tutorial";
        const tilt = steerable ? smoothedDegreesRef.current : 0;
        // Steering speed scales with the field width so the same tilt covers
        // the same fraction of the screen on any display — wide screens get
        // no extra range, narrow ones no extra twitchiness.
        rocketLeftRef.current = Math.max(
          20,
          Math.min(
            window.innerWidth - 52,
            rocketLeftRef.current -
              (tilt / 6) *
                sensitivityRef.current *
                frostFactorRef.current *
                gameplayScale() *
                33 *
                dt
          )
        );
        if (rocketLeftRef.current !== lastWrittenLeft) {
          lastWrittenLeft = rocketLeftRef.current;
          rocketEl.style.left = `${rocketLeftRef.current}px`;
        }
        if (rocketTiltRef.current) {
          const rot = `${(-tilt / 2).toFixed(2)}deg`;
          if (rot !== lastWrittenRot) {
            lastWrittenRot = rot;
            rocketTiltRef.current.style.transform = `rotate(${rot})`;
          }
        }
      }

      // Post-collision invincibility (plus the dash window) gates collisions;
      // only real hits drive the red collision flash.
      const invincible = now < invincibleUntil || now < dashUntilRef.current;
      const hitInvincible = now < invincibleUntil;
      if (hitInvincible !== collidingShown) {
        collidingShown = hitInvincible;
        setIsColliding(hitInvincible);
      }

      // Gesture shield: drains energy while held during play, recharges
      // otherwise. The ring's opacity shows the remaining charge.
      if (gameStateRef.current === "playing" && gestureShieldActiveRef.current) {
        gestureShieldEnergyRef.current = Math.max(
          0,
          gestureShieldEnergyRef.current - SHIELD_DRAIN_PER_S * dt
        );
        if (gestureShieldEnergyRef.current <= 0) {
          gestureShieldEnergyRef.current = 0;
          gestureShieldActiveRef.current = false;
        }
      } else {
        gestureShieldEnergyRef.current = Math.min(
          100,
          gestureShieldEnergyRef.current + SHIELD_RECHARGE_PER_S * dt
        );
      }
      const gsVisible =
        gestureShieldActiveRef.current && gestureShieldEnergyRef.current > 0;
      if (gsVisible !== gestureShieldVisibleRef.current) {
        gestureShieldVisibleRef.current = gsVisible;
        setGestureShield(gsVisible);
      }
      if (shieldRingRef.current) {
        shieldRingRef.current.style.opacity = gsVisible
          ? String(0.45 + 0.55 * (gestureShieldEnergyRef.current / 100))
          : "1";
      }

      // First-play tutorial lessons run their own minimal physics.
      if (gameStateRef.current === "tutorial") {
        updateTutorial(now, dt, rocketRef.current?.getBoundingClientRect());
      }

      // 3-2-1 countdown before play begins.
      if (gameStateRef.current === "countdown") {
        const remaining = Math.max(
          0,
          Math.ceil(COUNTDOWN_SECONDS - (now - countdownStartRef.current) / 1000)
        );
        if (remaining !== countdownRef.current) {
          countdownRef.current = remaining;
          setCountdown(remaining);
        }
        if (remaining === 0) {
          // First time play begins: brief the pilot on the opening chapter.
          if (!zoneIntroShownRef.current) {
            zoneIntroShownRef.current = true;
            showBanner({
              title: `Zone ${zoneRef.current} — ${getZone(zoneRef.current).name}`,
              subtitle: getZoneStory(zoneRef.current).chapter,
              objective: getZoneStory(zoneRef.current).objective,
              variant: "zone",
            });
          }
          // A resume that reaches "playing" is no longer mid-resume.
          resumingRef.current = false;
          transitionTo("playing");
        }
      }

      // Score popups and particles animate during play AND the tutorial, so
      // tutorial feedback (graze popups, pickup explosions) doesn't freeze.
      if (
        gameStateRef.current === "playing" ||
        gameStateRef.current === "tutorial"
      ) {
        // Score popups float up and fade out.
        let popupsChanged = false;
        const livePopups: ScorePopup[] = [];
        for (const sp of scorePopupsRef.current) {
          sp.life -= dt;
          if (sp.life <= 0) {
            popupsChanged = true;
            continue;
          }
          sp.y -= 45 * dt;
          const el = scorePopupElsRef.current.get(sp.key);
          if (el) {
            el.style.transform = `translate3d(${sp.x}px, ${sp.y}px, 0)`;
            el.style.opacity = String(
              Math.max(0, Math.min(1, sp.life / sp.maxLife))
            );
          }
          livePopups.push(sp);
        }
        if (popupsChanged) {
          scorePopupsRef.current = livePopups;
          setScorePopups(livePopups);
        }

        // Advance the particle system (explosions + trail): move, damp,
        // spin and fade; drop dead particles.
        let particlesChanged = false;
        const liveParticles: ParticleData[] = [];
        for (const p of particlesRef.current) {
          p.life -= dt;
          if (p.life <= 0) {
            particlesChanged = true;
            continue;
          }
          if (p.gravity) p.vy += p.gravity * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= Math.max(0, 1 - 2.5 * dt);
          p.vy *= Math.max(0, 1 - 2.5 * dt);
          p.rotation += p.rotSpeed * dt;
          const el = particleElsRef.current.get(p.key);
          if (el) {
            // Growing particles (smoke, flame, shockwave rings) expand in
            // place while their transform moves them.
            if (p.growth) {
              p.size = Math.max(0.5, p.size + p.growth * dt);
              el.style.width = `${p.size}px`;
              el.style.height = `${p.size}px`;
            }
            el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rotation}deg)`;
            el.style.opacity = String(
              Math.max(0, Math.min(1, p.life / p.maxLife))
            );
          }
          liveParticles.push(p);
        }
        if (particlesChanged) {
          particlesRef.current = liveParticles;
          setParticles(liveParticles);
        }
      }

      if (gameStateRef.current === "playing") {
        const viewportHeight = window.innerHeight;
        const rocket = rocketRef.current?.getBoundingClientRect();
        const slowmoFactor = now < slowmoUntil ? SLOWMO_FACTOR : 1;

        // Frost debuff from Ice Field shards wears off after FROST_MS.
        if (frostUntil > 0 && now >= frostUntil && frostedRef.current) {
          frostedRef.current = false;
          frostFactorRef.current = 1;
          setFrosted(false);
        }

        // Combo decays after a gap without grazing.
        if (comboRef.current > 1 && now > comboUntil) {
          comboRef.current = 1;
          setCombo(1);
        }

        // Engine trail: a small glowing particle at the rocket's tail.
        trailAccumulator += dt;
        if (trailAccumulator >= TRAIL_EMIT_INTERVAL) {
          trailAccumulator = 0;
          if (rocket) {
            emitTrailParticle(rocket);
          }
        }

        // Player bolts: fly upward, shatter meteors, chip the guardian, and
        // despawn off the top. Runs during both the belt and boss fights so
        // shots stay useful — but the ammo cap + meter keep them a limited
        // tool, never a way to clear the path outright.
        if (boltsRef.current.length > 0) {
          let boltsChanged = false;
          let destroyedMeteor = false;
          const liveBolts: Bolt[] = [];
          const bossRect = bossActiveRef.current
            ? bossRef.current?.getBoundingClientRect()
            : null;
          for (const bolt of boltsRef.current) {
            bolt.y -= BOLT_SPEED * slowmoFactor * dt;
            const el = boltElsRef.current.get(bolt.key);
            if (el) {
              el.style.transform = `translate3d(${
                bolt.x - bolt.size / 2
              }px, ${bolt.y - bolt.size / 2}px, 0)`;
            }
            let consumed = false;
            // vs the belt (meteors only exist outside boss fights).
            if (!bossActiveRef.current) {
              for (const b of bouldersRef.current) {
                if (b.hit) continue;
                if (
                  bolt.x > b.x + 4 &&
                  bolt.x < b.x + b.size - 4 &&
                  bolt.y > b.y + 4 &&
                  bolt.y < b.y + b.size - 4
                ) {
                  b.hit = true;
                  consumed = true;
                  destroyedMeteor = true;
                  const pts = boltReward(bolt.charge >= SHOOT_CHARGED_MIN);
                  scoreBonusRef.current += pts;
                  checkHighScore();
                  spawnExplosion(b.x + b.size / 2, b.y + b.size / 2, 14);
                  spawnScorePopup(
                    b.x + b.size / 2,
                    b.y + b.size / 2 - 10,
                    `+${pts}`,
                    "#7dd3fc"
                  );
                  break;
                }
              }
            }
            // vs the guardian (the belt is paused during boss fights).
            if (!consumed && bossRect && !bolt.hit) {
              if (
                bolt.x > bossRect.left &&
                bolt.x < bossRect.right &&
                bolt.y > bossRect.top &&
                bolt.y < bossRect.bottom
              ) {
                const dmg =
                  bolt.charge >= SHOOT_CHARGED_MIN
                    ? BOLT_BOSS_DAMAGE_CHARGED
                    : BOLT_BOSS_DAMAGE;
                bossHpRef.current = Math.max(0, bossHpRef.current - dmg);
                consumed = true;
                spawnExplosion(bolt.x, bolt.y, 16);
                spawnScorePopup(
                  bolt.x,
                  bolt.y - 14,
                  `-${Math.round(dmg * 100)}%`,
                  "#f87171"
                );
              }
            }
            if (consumed || bolt.y < -40) {
              boltsChanged = true;
              continue;
            }
            liveBolts.push(bolt);
          }
          if (destroyedMeteor) {
            bouldersRef.current = bouldersRef.current.filter((b) => !b.hit);
            setBoulders(bouldersRef.current);
          }
          if (boltsChanged) {
            boltsRef.current = liveBolts;
            setBolts(liveBolts);
          }
        }

        if (bossActiveRef.current) {
          updateBoss(now, dt, rocket, invincible, slowmoFactor);
        } else {
          // Spawn a batch of meteors on a fixed cadence.
          spawnAccumulator += dt * 1000;
          if (spawnAccumulator >= SPAWN_INTERVAL_MS) {
            spawnAccumulator -= SPAWN_INTERVAL_MS;
            const speed = fallSpeed(distanceRef.current);
            // Meteor count scales with viewport width so density per unit of
            // field stays constant — a phone and an ultrawide face the same
            // belt. Sizes scale too so they read the same relative to the
            // field on every screen. The count ALSO ramps with distance:
            // the belt starts thin (~1-2 per spawn) and only thickens as the
            // run deepens, so the opening never swarms a new player.
            const sk = spriteScale();
            const ramp = Math.min(
              4.5,
              1.5 + (distanceRef.current / 2000) * 3
            );
            const count = Math.max(1, Math.round(ramp * gameplayScale()));
            const fresh: Boulder[] = [];
            // 20% coverage cap: the total on-screen meteor area never exceeds
            // a fifth of the viewport, no matter how deep the run gets — the
            // belt can ramp in count but never wall the screen.
            const maxCover = window.innerWidth * window.innerHeight * 0.2;
            let cover = bouldersRef.current.reduce(
              (s, b) => s + b.size * b.size,
              0
            );
            for (let i = 0; i < count; i++) {
              const size = Math.max(
                22,
                (Math.random() * (60 - 38) + 38) * sk
              );
              if (cover + size * size > maxCover) break;
              cover += size * size;
              fresh.push({
                key: `${Date.now()}-${Math.random()}`,
                x: Math.random() * (window.innerWidth - 80 * sk),
                y: -Math.random() * 100 - 100,
                size,
                rotation: Math.random() * 360,
                speed,
                hit: false,
                grazed: false,
                variant: Math.floor(Math.random() * 3),
              });
            }
            bouldersRef.current = [...bouldersRef.current, ...fresh];
            setBoulders(bouldersRef.current);
          }

          // Move meteors, check collisions/grazes, despawn off-screen.
          let despawned = false;
          const remaining: Boulder[] = [];
          for (const b of bouldersRef.current) {
            b.y += b.speed * slowmoFactor * dt;
            const el = boulderElsRef.current.get(b.key);
            if (el) {
              el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0) rotate(${b.rotation}deg)`;
            }
            if (b.y > viewportHeight + b.size) {
              despawned = true;
              continue;
            }
            if (!b.hit && rocket) {
              const inset = COLLISION_INSET * spriteScale();
              const boulderBox = {
                left: b.x + inset,
                right: b.x + b.size - inset,
                top: b.y + inset,
                bottom: b.y + b.size - inset,
              };
              const overlapping =
                boulderBox.left < rocket.right &&
                boulderBox.right > rocket.left &&
                boulderBox.top < rocket.bottom &&
                boulderBox.bottom > rocket.top;
              if (!invincible && overlapping) {
                b.hit = true;
                handleHit(
                  now,
                  (rocket.left + rocket.right) / 2,
                  (rocket.top + rocket.bottom) / 2
                );
                spawnExplosion(b.x + b.size / 2, b.y + b.size / 2, 12);
              } else if (!overlapping && !b.grazed) {
                // Near-miss: thread past a meteor without hitting it.
                const dist = Math.hypot(
                  b.x + b.size / 2 - (rocket.left + rocket.right) / 2,
                  b.y + b.size / 2 - (rocket.top + rocket.bottom) / 2
                );
                if (dist < GRAZE_RADIUS * gameplayScale() + b.size / 2) {
                  b.grazed = true;
                  comboRef.current = Math.min(comboRef.current + 1, COMBO_MAX);
                  comboUntil = now + COMBO_WINDOW_MS;
                  setCombo(comboRef.current);
                  runStatsRef.current.grazes += 1;
                  runStatsRef.current.maxCombo = Math.max(
                    runStatsRef.current.maxCombo,
                    comboRef.current
                  );
                  // Grazes charge the shot meter — flying dangerously earns
                  // your shots.
                  gainShootMeter(SHOOT_METER_PER_GRAZE);
                  // Track the best combo inside the current zone for the
                  // journey log (read at game over, no re-renders).
                  const zoneEntry = journeyRef.current[
                    journeyRef.current.length - 1
                  ];
                  if (zoneEntry) {
                    zoneEntry.bestCombo = Math.max(
                      zoneEntry.bestCombo,
                      comboRef.current
                    );
                  }
                  unlockBadge("graze");
                  if (comboRef.current >= COMBO_MAX) {
                    unlockBadge("combo10");
                  }
                  const multiplier = now < doubleUntil ? 2 : 1;
                  const points = grazePoints(
                    comboRef.current,
                    multiplier === 2
                  );
                  scoreBonusRef.current += points;
                  checkHighScore();
                  spawnScorePopup(
                    b.x + b.size / 2,
                    b.y + b.size / 2 - 12,
                    `+${points}`
                  );
                }
              }
            }
            remaining.push(b);
          }
          if (despawned) {
            bouldersRef.current = remaining;
            setBoulders(remaining);
          }

          // Power-ups drift down; grab them by steering into them.
          powerUpSpawnTimer += dt;
          if (powerUpSpawnTimer >= POWER_UP_INTERVAL) {
            powerUpSpawnTimer = 0;
            spawnPowerUp();
          }
          let powerUpChanged = false;
          const livePowerUps: PowerUp[] = [];
          for (const p of powerUpsRef.current) {
            p.y += p.speed * slowmoFactor * dt;
            p.rotation += 90 * dt;
            const el = powerUpElsRef.current.get(p.key);
            if (el) {
              el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rotation}deg)`;
            }
            if (p.y > viewportHeight + p.size) {
              powerUpChanged = true;
              continue;
            }
            if (rocket && !p.hit) {
              const box = {
                left: p.x + 4,
                right: p.x + p.size - 4,
                top: p.y + 4,
                bottom: p.y + p.size - 4,
              };
              if (
                box.left < rocket.right &&
                box.right > rocket.left &&
                box.top < rocket.bottom &&
                box.bottom > rocket.top
              ) {
                p.hit = true;
                powerUpChanged = true;
                applyPowerUp(now, p.x + p.size / 2, p.y + p.size / 2, p.type);
                continue;
              }
            }
            livePowerUps.push(p);
          }
          if (powerUpChanged) {
            powerUpsRef.current = livePowerUps;
            setPowerUps(livePowerUps);
          }

          // Score ticks at a fixed 10Hz; every ZONE_DISTANCE meters a boss
          // guards the boundary into the next zone.
          distanceAccumulator += dt * 1000;
          if (distanceAccumulator >= SCORE_TICK_MS) {
            distanceAccumulator -= SCORE_TICK_MS;
            // The distance meter doubles as the base score, so the scoring
            // cut slows the tick itself: +0.9 per 100ms (9 m/s), carried
            // fractionally so the displayed value stays a clean integer.
            distanceCarry += distanceTickIncrement();
            if (distanceCarry >= 1) {
              distanceCarry -= 1;
              const d = distanceRef.current + 1;
              distanceRef.current = d;
              setDistance(d);
              checkHighScore();
              if (d >= ZONE_DISTANCE) {
                unlockBadge("marathon");
              }
              if (d >= nextBossAtRef.current) {
                startBoss(now);
              }
            }
          }
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [transitionTo, advanceTutorialStep, completeTutorial, unlockBadge]);

  const selectSkin = useCallback((id: SkinId) => {
    setSkinId(id);
    saveSelectedSkin(id);
  }, []);

  return {
    // Camera / detection
    isDetected,
    isLoading,
    cameraError,
    lowLight,
    cameraRetry,
    retryCamera,
    // State machine + HUD
    gameState,
    countdown,
    isColliding,
    distance,
    livesRemainingState,
    reserveLives,
    highScore,
    combo,
    shield,
    gestureShield,
    frosted,
    isDashing,
    zone,
    zoneBanner,
    bossActive,
    bossFlash,
    bossBarVisible,
    bossProjectiles,
    // Moving entities (React mounts/unmounts; the loop mutates the DOM)
    boulders,
    particles,
    powerUps,
    scorePopups,
    bolts,
    shootMeter,
    // Progression
    tutorialStep,
    badges,
    skinId,
    selectSkin,
    gameOverStats,
    // Input
    sensitivity,
    changeSensitivity,
    // Leaderboard flow
    leaderboardRefresh,
    postedRunId,
    pendingQualify,
    confirmLeaderboardName,
    dismissLeaderboardName,
    confettiSeed,
    leaderboardOpen,
    setLeaderboardOpen,
    // Handlers
    completeTutorial,
    setHandResults,
    // Refs the page needs for JSX wiring
    rocketRef,
    rocketTiltRef,
    shakeWrapperRef,
    starfieldSpeedRef,
    shieldRingRef,
    bossRef,
    bossBarFillRef,
    registerBoulderEl,
    registerParticleEl,
    registerBoltEl,
    menuCursorRef,
    menuBackRef,
    guideOpenRef,
    powerUpElsRef,
    scorePopupElsRef,
    bossProjectileElsRef,
    registerTiltMarker,
  };
}

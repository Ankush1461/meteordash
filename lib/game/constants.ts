// --- Tunable gameplay constants (extracted from the original page monolith) ---

// --- Responsive gameplay scaling ---------------------------------------
// Gameplay is normalized to a 1280×800 reference viewport so no player gets
// an advantage from screen size: meteor density per unit width, steering
// speed relative to the field, fall time relative to screen height and
// sprite sizes all scale with the actual viewport. The gameplay clamps keep
// speeds/counts fair on extreme screens; the gentler sprite clamps keep
// sprites visible on phones and bounded on ultrawides.
export const REF_WIDTH = 1280;
export const SCALE_MIN = 0.45;
export const SCALE_MAX = 2.2;
export const SIZE_SCALE_MIN = 0.7;
export const SIZE_SCALE_MAX = 1.5;

export const START_LIVES = 4;
// Hearts grabbed while already at max lives bank as reserve lives instead of
// going to waste; each reserve absorbs one hit before an active life is lost.
export const RESERVE_LIVES_MAX = 3;
export const SPAWN_INTERVAL_MS = 1000;
export const INVINCIBILITY_MS = 1500;
export const SCORE_TICK_MS = 100;
export const COLLISION_INSET = 28;
export const MIN_FALL_DURATION = 1.5;
export const TILT_SMOOTHING = 0.40; // EMA alpha: higher = snappier and more responsive, lower = smoother but heavier lag
export const DEFAULT_SENSITIVITY = 1;
export const MIN_SENSITIVITY = 0.5;
export const MAX_SENSITIVITY = 3;
export const COUNTDOWN_SECONDS = 3;
export const SHAKE_DURATION_MS = 450;
export const SHAKE_AMOUNT = 10; // max px of shake offset
export const TRAIL_EMIT_INTERVAL = 0.04; // seconds between engine trail particles
export const MAX_PARTICLES = 150;
export const ZONE_DISTANCE = 500;
export const GRAZE_RADIUS = 65; // near-miss ring around the rocket center
// Global scoring difficulty: distance ticks, power-ups and the boss bonus
// pay this fraction, so a run of the same skill scores ~10% lower. Grazes
// instead follow the progressive combo curve below, which concentrates the
// cut on long chains. Zone boundaries/badges still key off the same
// distance meter — it just accrues at 9 m/s instead of 10.
export const SCORE_MULTIPLIER = 0.9;

// Progressive graze penalty curve. The 10% scoring cut is spread across the
// combo range so it bites hardest on long streaks: a combo-1 graze keeps
// ~98% of its value, a combo-10 graze only ~85% (the combo-weighted average
// stays ≈ 90%). Early safe grazes stay rewarding; deep chains — the highest
// skill ceiling — pay for their reach.
export const COMBO_SCALING_START = 0.98;
export const COMBO_SCALING_END = 0.85;
export const COMBO_WINDOW_MS = 3000; // combo decays after this long without a graze
export const COMBO_MAX = 10;
export const GRAZE_POINTS = 10; // per graze, × combo
export const POWER_UP_INTERVAL = 4; // seconds between power-up spawn chances
export const POWER_UP_POINTS = 25; // pickup bonus, × multiplier
export const SLOWMO_DURATION_MS = 5000;
export const SLOWMO_FACTOR = 0.55;
export const DOUBLE_DURATION_MS = 8000;
export const DASH_IFRAMES_MS = 600; // invincibility window granted by a dash
export const DASH_COOLDOWN_MS = 2500; // min gap between dashes
export const GESTURE_HOLD_FRAMES = 3; // consecutive detections (~100ms) to confirm a gesture
// Menu cursor "DPI": how much farther the cursor moves than the pointing
// hand, pivoting on the screen centre (1.5 = half the hand motion reaches
// the screen edge).
export const MENU_CURSOR_DPI = 1.5;
// Menu-cursor assist: buttons magnetically pull the cursor toward their
// centre within this radius (capped pull per frame, so it glides — never
// teleports), and a pinch/fist confirm lands on the nearest button within
// this grace radius even when the fingertip is slightly off target. This is
// what makes hand-aimed menu navigation reliable on the game-over/pause
// screens, where buttons are small and the hand is jittery.
export const MENU_SNAP_RADIUS = 150; // px: cursor gets attracted to a button
export const MENU_CLICK_GRACE = 140; // px: a confirm still clicks the nearest button
// Frames the menu cursor stays visible at its last position while the
// pointing pose flickers off (~130ms at 30Hz) — a single dropped frame must
// not blink the cursor or drop the hover highlight.
export const MENU_POINT_LOST_FRAMES = 4;
export const SHIELD_DRAIN_PER_S = 28; // gesture-shield energy drained per second held
export const SHIELD_RECHARGE_PER_S = 12; // energy regained per second while released
export const SHIELD_BLOCK_ENERGY = 35; // energy consumed to absorb one hit
export const DASH_COLORS = ["#7dd3fc", "#38bdf8", "#e0f2fe", "#ffffff"];

// --- Pinch-to-fire: the only offensive option ------------------------------
// Gated twice so shooting can never replace dodging: (1) a gesture meter that
// fills ONLY from grazes and dashes (never passively), and (2) a hard cap on
// bolts in flight that frees up as bolts resolve — you can't chain-fire a
// clear path, you have to earn each shot by flying dangerously.
export const SHOOT_METER_MAX = 100;
export const SHOOT_METER_PER_GRAZE = 10; // energy per near-miss graze
export const SHOOT_METER_PER_DASH = 20; // energy per dash
export const SHOOT_ENERGY_COST = 30; // energy consumed by an uncharged bolt
export const SHOOT_ENERGY_CHARGED_COST = 60; // energy consumed by a charged bolt
// Hold time before the charge starts building, then how long to reach full.
export const SHOOT_CHARGE_MS = 500;
export const SHOOT_CHARGE_FULL_MS = 1200;
// A shot only counts as "charged" once it's at least this full.
export const SHOOT_CHARGED_MIN = 0.75;
export const SHOOT_MAX_BOLTS = 3; // hard cap on bolts in flight ("ammo")
export const BOLT_SPEED = 1250; // px/s upward — faster exit means the
// 3-bolt ammo cap recycles sooner (quicker reload between shots)
export const BOLT_SCORE = 25; // flat reward per meteor destroyed
export const BOLT_BOSS_DAMAGE = 0.1; // guardian HP fraction per uncharged bolt
export const BOLT_BOSS_DAMAGE_CHARGED = 0.22; // per charged bolt

export const FROST_MS = 3000; // ice shard slow debuff duration
// Shard hits (unshielded) needed to lose a life; each hit also frosts.
export const FROST_HITS_TO_LIFE = 2;
export const FROST_FACTOR = 0.5; // steering responsiveness while frosted

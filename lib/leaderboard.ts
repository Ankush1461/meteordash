/**
 * Leaderboard persistence + validation.
 *
 * Production (Vercel): uses Upstash Redis when `KV_REST_API_URL` and
 * `KV_REST_API_TOKEN` are set — auto-synced by the Vercel Marketplace
 * Upstash Redis integration.
 * Local dev: falls back to a JSON file under `.data/` so the API works
 * without provisioning anything (the file is gitignored; it does NOT persist
 * on Vercel's ephemeral functions — Redis is the production store).
 */
import { Redis } from "@upstash/redis";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface ScoreEntry {
  /** Client-generated idempotency key: one post per run, ever. */
  runId: string;
  name: string;
  /** Total run score (distance + bonus). */
  score: number;
  /** Meters flown. */
  distance: number;
  /** Furthest zone reached (1–5). */
  zone: number;
  maxCombo: number;
  grazes: number;
  /** How many power-ups the run collected. */
  powerUps: number;
  /** How many guardians the run defeated (0–5). */
  bosses: number;
  /** Wall-clock length of the run, ms (includes pause time). */
  durationMs: number;
  /** Epoch ms when the run ended. */
  date: number;
}

const KV_KEY = "meteordash:leaderboard";
const MAX_ENTRIES = 100;
const TOP_N = 10;

// ---------------------------------------------------------------------------
// HMAC-signed submissions.
//
// The server issues a short-lived per-run token at run start (stateless:
// the token is a signed payload, no storage). The client signs the canonical
// run data with that token; the API rejects unsigned or tampered scores.
// This stops posting without ever starting a run and makes replayed or
// edited submissions fail — combined with the consistency validation below
// it raises the bar for forgeries. Set LEADERBOARD_SECRET in production;
// a fixed dev secret keeps local dev working.
// ---------------------------------------------------------------------------

const TOKEN_TTL_MS = 60 * 60 * 1000; // runs last seconds-to-minutes; 60 min headroom

function getSecret(): string | null {
  if (process.env.LEADERBOARD_SECRET) return process.env.LEADERBOARD_SECRET;
  if (process.env.NODE_ENV !== "production") return "dev-leaderboard-secret";
  return null; // production without the secret: signing is disabled
}

/** Issues a short-lived token bound to a runId, or null if signing is off. */
export function createRunToken(
  runId: string
): { token: string; expiresAt: number } | null {
  const secret = getSecret();
  if (!secret) return null;
  const iat = Date.now();
  const exp = iat + TOKEN_TTL_MS;
  const payload = Buffer.from(
    JSON.stringify({ runId, iat, exp })
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return { token: `${payload}.${sig}`, expiresAt: exp };
}

/** Verifies a token's signature, expiry, and shape. */
export function verifyRunToken(token: string): { runId: string } | null {
  const secret = getSecret();
  if (!secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let parsed: { runId?: unknown; exp?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed.runId !== "string" || typeof parsed.exp !== "number") {
    return null;
  }
  if (parsed.exp < Date.now()) return null; // expired
  return { runId: parsed.runId };
}

/**
 * Canonical serialization of the signed run fields, in a fixed key order.
 * The client builds the identical string from its payload before signing.
 */
export function canonicalRunData(b: Record<string, unknown>): string {
  return JSON.stringify({
    runId: b.runId,
    score: b.score,
    distance: b.distance,
    zone: b.zone,
    maxCombo: b.maxCombo,
    grazes: b.grazes,
    powerUps: b.powerUps,
    bosses: b.bosses,
    durationMs: b.durationMs,
  });
}

/** Constant-time check of an HMAC-SHA256 hex signature (token is the key). */
export function verifyRunSignature(
  token: string,
  canonical: string,
  sig: string
): boolean {
  const expected = crypto
    .createHmac("sha256", token)
    .update(canonical)
    .digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const kv =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

// Overridable for tests so the API suite never touches the real store.
const filePath =
  process.env.LEADERBOARD_FILE ||
  path.join(process.cwd(), ".data", "leaderboard.json");

// In-memory mirror of the file store. On read-only filesystems (e.g. Vercel
// functions without KV) writes fall back to this so the leaderboard still
// works within the instance's lifetime instead of 503ing.
let memStore: ScoreEntry[] | null = null;

function readFileStore(): ScoreEntry[] {
  if (memStore) return memStore;
  try {
    // turbopackIgnore: this file store is a dev/local fallback — production
    // uses Vercel KV. Without the ignore, Turbopack traces the whole project
    // into the server bundle (see lib/leaderboard.ts header).
    memStore = JSON.parse(
      fs.readFileSync(/* turbopackIgnore: true */ filePath, "utf8")
    ) as ScoreEntry[];
  } catch {
    memStore = [];
  }
  return memStore;
}

function writeFileStore(entries: ScoreEntry[]): void {
  memStore = entries;
  try {
    fs.mkdirSync(/* turbopackIgnore: true */ path.dirname(filePath), {
      recursive: true,
    });
    fs.writeFileSync(/* turbopackIgnore: true */ filePath, JSON.stringify(entries), "utf8");
  } catch {
    // Read-only filesystem: keep serving from memory for this instance.
    // Persistence requires Vercel KV (see README deployment notes).
  }
}

async function readAll(): Promise<ScoreEntry[]> {
  if (kv) {
    return ((await kv.get<ScoreEntry[]>(KV_KEY)) ?? []) as ScoreEntry[];
  }
  return readFileStore();
}

async function writeAll(entries: ScoreEntry[]): Promise<void> {
  if (kv) {
    await kv.set(KV_KEY, entries);
  } else {
    writeFileStore(entries);
  }
}

/** Returns the top-N entries, newest first among equal scores. */
export async function getTopScores(n = TOP_N): Promise<ScoreEntry[]> {
  const all = await readAll();
  return all
    .slice()
    .sort((a, b) => b.score - a.score || b.date - a.date)
    .slice(0, n);
}

/**
 * Whether a score would crack the top-N right now, and the rank it would get.
 * Used to decide whether to prompt the player for a callsign before posting.
 * Ties qualify: any score better than the current Nth place's score makes it.
 */
export async function checkQualification(
  score: number,
  n = TOP_N
): Promise<{ qualifies: boolean; rank: number | null }> {
  const all = await readAll();
  const strictlyBetter = all.filter((e) => e.score > score).length;
  const rank = strictlyBetter + 1;
  return { qualifies: rank <= n, rank: rank <= n ? rank : null };
}

/**
 * Insert a score. Scores with a duplicate runId are ignored (idempotent —
 * retries, StrictMode double-fires and double game-overs can't double-count).
 * Returns the entry's rank (1-based, null if rejected as duplicate).
 */
export async function submitScore(entry: ScoreEntry): Promise<number | null> {
  const all = await readAll();
  if (all.some((e) => e.runId === entry.runId)) return null;
  const next = [...all, entry].sort(
    (a, b) => b.score - a.score || b.date - a.date
  );
  await writeAll(next.slice(0, MAX_ENTRIES));
  const rank = next.findIndex((e) => e.runId === entry.runId) + 1;
  return rank > 0 ? rank : null;
}

// ---------------------------------------------------------------------------
// Validation — client-submitted scores are untrusted, so bounds are enforced
// server-side. Generous caps (a great run is ~2,500 m across all 5 zones);
// the hard rule is score >= distance, since distance is always part of score.
// ---------------------------------------------------------------------------

const MAX_NAME_LENGTH = 16;
const MAX_SCORE = 5_000_000;
const MAX_DISTANCE = 1_000_000;

// --- Run-consistency bounds, derived from the game's actual mechanics. ---
// Distance ticks at +1 per 100 ms (10 m/s); slow-mo only slows boulders, never
// the ship's forward motion, so 10.5 m/s is a hard ceiling with tick slop.
const MAX_SPEED_MPS = 10.5;
// Includes the 3s countdown; you can't realistically end a run faster.
const MIN_DURATION_MS = 2_000;
const MAX_DURATION_MS = 2 * 60 * 60 * 1000; // 2h of perfect dodging
// Combo is hard-capped at ×10 in the game loop.
const MAX_COMBO = 10;
// Max bonus a single graze can pay (10 pts × combo 10 × 2x double), a single
// power-up (25 × 2x), and a guardian clear (+500). These bound the total
// bonus (score − distance) a run could possibly earn from its reported stats.
const MAX_GRAZE_POINTS = 200;
const MAX_POWERUP_POINTS = 50;
const BOSS_BONUS = 500;
const MAX_BOSSES = 5; // one per zone, five zones
// Power-ups spawn on a 4s timer, so collections can't outpace the spawn rate.
const POWER_UP_INTERVAL_S = 4;
// Generous per-second ceilings so insane counts fail but real play sails under.
const MAX_GRAZES_PER_S = 30;
const MAX_POWERUPS_PER_S = 1 / 3;

function toFinite(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Returns a sanitized score entry, or null when the payload is rejected. */
export function validateScore(body: unknown): ScoreEntry | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  const runId = typeof b.runId === "string" ? b.runId.trim().slice(0, 64) : "";
  if (runId.length === 0) return null;

  const nameRaw =
    typeof b.name === "string"
      ? b.name.replace(/[\u0000-\u001f\u007f]/g, "").trim()
      : "";
  const name = (nameRaw || "Pilot").slice(0, MAX_NAME_LENGTH);

  const score = toFinite(b.score);
  const distance = toFinite(b.distance);
  const zone = toFinite(b.zone);
  const maxCombo = toFinite(b.maxCombo);
  const grazes = toFinite(b.grazes);
  const powerUps = toFinite(b.powerUps);
  const bosses = toFinite(b.bosses);
  const durationMs = toFinite(b.durationMs);

  if (
    score === null ||
    distance === null ||
    zone === null ||
    durationMs === null
  )
    return null;
  if (
    !Number.isInteger(score) ||
    !Number.isInteger(distance) ||
    !Number.isInteger(durationMs)
  )
    return null;

  // --- Hard plausibility rules (reject, don't clamp, impossible runs). ---
  // The total score always includes distance.
  if (score < distance) return null;
  // Nonsense magnitudes.
  if (score > MAX_SCORE || distance > MAX_DISTANCE) return null;
  // Distance accrues at 10 m/s — a run can't cover more than that in its
  // wall-clock length (slow-mo only slows meteors, never the ship).
  if (distance / (durationMs / 1000) > MAX_SPEED_MPS) return null;
  if (durationMs < MIN_DURATION_MS || durationMs > MAX_DURATION_MS) return null;

  // Combo is capped at ×10 in the game loop — ×11 is impossible.
  if (maxCombo !== null && (maxCombo < 1 || maxCombo > MAX_COMBO)) return null;
  // One guardian per zone, five zones.
  if (bosses !== null && (bosses < 0 || bosses > MAX_BOSSES)) return null;

  // Collection counts can't outpace time.
  const secs = durationMs / 1000;
  if (grazes !== null && grazes > Math.floor(secs * MAX_GRAZES_PER_S)) return null;
  if (powerUps !== null && powerUps > Math.floor(secs * MAX_POWERUPS_PER_S) + 1)
    return null;

  // Zones only advance when a guardian is beaten (not merely reached), so a
  // player who dies at 2000 m without clearing the first boss is still in
  // zone 1 — the zone can never exceed the distance reached (500 m per
  // zone), but it can legitimately lag far behind it. Reject only the
  // impossible direction: claiming a zone the distance hasn't reached yet.
  const maxZoneForDistance = Math.min(5, Math.max(1, Math.floor(distance / 500) + 1));
  if (zone > maxZoneForDistance) return null;

  // Bonus (score − distance) can't exceed what the reported stats could pay:
  // every graze ≤ 200, every power-up ≤ 50, every boss clear +500.
  const bonus = score - distance;
  const maxBonus =
    (grazes ?? 0) * MAX_GRAZE_POINTS +
    (powerUps ?? 0) * MAX_POWERUP_POINTS +
    (bosses ?? 0) * BOSS_BONUS;
  if (bonus > maxBonus) return null;

  return {
    runId,
    name,
    score: Math.trunc(score),
    distance: Math.trunc(distance),
    zone: Math.trunc(zone),
    maxCombo:
      maxCombo !== null
        ? Math.max(1, Math.min(MAX_COMBO, Math.trunc(maxCombo)))
        : 1,
    grazes: grazes !== null ? Math.max(0, Math.trunc(grazes)) : 0,
    powerUps: powerUps !== null ? Math.max(0, Math.trunc(powerUps)) : 0,
    bosses: bosses !== null ? Math.max(0, Math.trunc(bosses)) : 0,
    durationMs: Math.trunc(durationMs),
    date: Date.now(),
  };
}

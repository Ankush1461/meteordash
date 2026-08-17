// Pure scoring math, extracted from the engine so it can be unit-tested.
// The engine calls these functions directly — the tests here exercise the
// exact formulas players score with.
import {
  BOLT_SCORE,
  COMBO_MAX,
  COMBO_SCALING_END,
  COMBO_SCALING_START,
  GRAZE_POINTS,
  POWER_UP_POINTS,
  SCORE_MULTIPLIER,
  SCORE_TICK_MS,
} from "./constants";

/**
 * Progressive graze penalty curve. The 10% scoring cut is spread across the
 * combo range so it bites hardest on long streaks: a combo-1 graze keeps
 * ~98% of its value, a combo-10 graze only ~85% (the combo-weighted average
 * stays ≈ 90%). Early safe grazes stay rewarding; deep chains — the highest
 * skill ceiling — pay for their reach.
 */
export function comboScale(combo: number): number {
  const c = Math.max(1, Math.min(combo, COMBO_MAX));
  return (
    COMBO_SCALING_START +
    ((COMBO_SCALING_END - COMBO_SCALING_START) * (c - 1)) / (COMBO_MAX - 1)
  );
}

/** Points for a near-miss graze at the given combo (×2 when doubled). */
export function grazePoints(combo: number, doubled: boolean): number {
  return Math.floor(
    GRAZE_POINTS * Math.max(1, combo) * (doubled ? 2 : 1) * comboScale(combo)
  );
}

/** Points for a power-up pickup (×2 when doubled). */
export function powerUpPoints(doubled: boolean): number {
  return Math.floor(POWER_UP_POINTS * (doubled ? 2 : 1) * SCORE_MULTIPLIER);
}

/** Points for shattering a meteor with a bolt (+50 when charged). */
export function boltReward(charged: boolean): number {
  return Math.floor(BOLT_SCORE * (charged ? 2 : 1));
}

/** Chapter reward for clearing a zone guardian. */
export function bossClearBonus(): number {
  return Math.floor(500 * SCORE_MULTIPLIER);
}

/** The distance meter accrues this many meters per second (9 m/s). */
export function distancePerSecond(): number {
  return SCORE_MULTIPLIER * (1000 / SCORE_TICK_MS);
}

/** Fractional meters added per 100ms score tick (0.9 — carried in the loop). */
export function distanceTickIncrement(): number {
  return SCORE_MULTIPLIER;
}

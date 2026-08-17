import { describe, expect, it } from "vitest";
import { COMBO_MAX } from "../lib/game/constants";
import {
  boltReward,
  bossClearBonus,
  comboScale,
  distancePerSecond,
  distanceTickIncrement,
  grazePoints,
  powerUpPoints,
} from "../lib/game/scoring";

describe("comboScale (progressive graze penalty curve)", () => {
  it("starts at ~0.98 (combo 1) and decays to ~0.85 (combo 10)", () => {
    expect(comboScale(1)).toBeCloseTo(0.98, 2);
    expect(comboScale(COMBO_MAX)).toBeCloseTo(0.85, 2);
  });

  it("is monotonically non-increasing across the combo range", () => {
    for (let c = 1; c < COMBO_MAX; c++) {
      expect(comboScale(c + 1)).toBeLessThanOrEqual(comboScale(c));
    }
  });

  it("clamps out-of-range combos", () => {
    expect(comboScale(0)).toBe(comboScale(1));
    expect(comboScale(99)).toBe(comboScale(COMBO_MAX));
  });

  it("averages ≈ 90% across the combo range (the 10% cut)", () => {
    let sum = 0;
    for (let c = 1; c <= COMBO_MAX; c++) sum += comboScale(c);
    expect(sum / COMBO_MAX).toBeCloseTo(0.9, 1);
  });
});

describe("grazePoints", () => {
  it("grows with combo (late streaks pay more)", () => {
    for (let c = 1; c < COMBO_MAX; c++) {
      expect(grazePoints(c + 1, false)).toBeGreaterThan(grazePoints(c, false));
    }
  });

  it("applies the 2× pickup before flooring (doubled ≈ 2×, ±1 rounding)", () => {
    for (let c = 1; c <= COMBO_MAX; c++) {
      const normal = grazePoints(c, false);
      const doubled = grazePoints(c, true);
      expect(doubled).toBeGreaterThanOrEqual(normal * 2);
      expect(doubled).toBeLessThanOrEqual(normal * 2 + 1);
    }
    // floor(10 × 1 × 2 × 0.98) = floor(19.6) = 19
    expect(grazePoints(1, true)).toBe(19);
  });

  it("always returns integers", () => {
    for (let c = 1; c <= COMBO_MAX; c++) {
      expect(Number.isInteger(grazePoints(c, false))).toBe(true);
      expect(Number.isInteger(grazePoints(c, true))).toBe(true);
    }
  });

  it("combo-1 graze pays 9 (10 × 1 × 0.98)", () => {
    expect(grazePoints(1, false)).toBe(9);
  });

  it("combo-10 graze pays 85 (10 × 10 × 0.85)", () => {
    expect(grazePoints(10, false)).toBe(85);
  });
});

describe("powerUpPoints", () => {
  it("pays 22 normally (25 × 0.9)", () => {
    expect(powerUpPoints(false)).toBe(22);
  });
  it("pays 45 doubled (25 × 2 × 0.9)", () => {
    expect(powerUpPoints(true)).toBe(45);
  });
});

describe("boltReward", () => {
  it("pays 25 for a normal bolt", () => {
    expect(boltReward(false)).toBe(25);
  });
  it("pays 50 for a charged bolt", () => {
    expect(boltReward(true)).toBe(50);
  });
});

describe("bossClearBonus", () => {
  it("pays 450 (500 × 0.9)", () => {
    expect(bossClearBonus()).toBe(450);
  });
});

describe("distance accrual", () => {
  it("ticks at 9 m/s", () => {
    expect(distancePerSecond()).toBeCloseTo(9, 5);
  });
  it("carries 0.9 per 100ms tick", () => {
    expect(distanceTickIncrement()).toBeCloseTo(0.9, 5);
  });
});

import { describe, expect, it } from "vitest";
import { MIN_FALL_DURATION } from "../lib/game/constants";
import {
  fallDuration,
  fallSpeed,
  gameplayScale,
  spriteScale,
} from "../lib/game/physics";

describe("fallDuration (belt speeds up with distance)", () => {
  it("is 10s at the start and through the first 50m", () => {
    expect(fallDuration(0)).toBe(10);
    expect(fallDuration(50)).toBe(10);
  });

  it("decays as the run deepens", () => {
    expect(fallDuration(100)).toBeLessThan(10);
    expect(fallDuration(500)).toBeLessThan(fallDuration(100));
    expect(fallDuration(2000)).toBeLessThan(fallDuration(500));
  });

  it("never goes below the minimum", () => {
    expect(fallDuration(1e9)).toBe(MIN_FALL_DURATION);
    expect(fallDuration(1e6)).toBeGreaterThanOrEqual(MIN_FALL_DURATION);
  });
});

describe("responsive scaling (SSR / no-window fallback)", () => {
  // These run under node where `window` is undefined — the helpers must
  // return the reference scale so SSR HTML matches the client's first paint.
  it("gameplayScale returns the reference scale without a window", () => {
    expect(gameplayScale()).toBe(1);
  });

  it("spriteScale returns the reference scale without a window", () => {
    expect(spriteScale()).toBe(1);
  });

  it("fallSpeed falls back to the reference screen height", () => {
    // (2100 + 250) / 10s with no window uses the 2100px reference.
    expect(fallSpeed(0)).toBeCloseTo(2100 / 10, 5);
    expect(fallSpeed(1000)).toBeCloseTo(2100 / fallDuration(1000), 5);
  });
});

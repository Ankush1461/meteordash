import { describe, expect, it } from "vitest";
import { validateScore } from "../lib/leaderboard";
import { SKINS } from "../utils/skins";

describe("Landing and Flow Mechanics", () => {
  it("includes all default skins for the landing page hangar", () => {
    expect(SKINS.length).toBeGreaterThanOrEqual(4);
    expect(SKINS.some((s) => s.id === "classic")).toBe(true);
    expect(SKINS.some((s) => s.id === "hunter")).toBe(true);
    expect(SKINS.some((s) => s.id === "dasher")).toBe(true);
    expect(SKINS.some((s) => s.id === "legend")).toBe(true);
  });

  it("validates stopped game runs correctly for leaderboard consideration", () => {
    const stoppedRun = {
      runId: "stopped-run-test-1",
      name: "AcePilot",
      score: 850,
      distance: 600,
      zone: 2,
      maxCombo: 5,
      grazes: 15,
      powerUps: 3,
      bosses: 1,
      durationMs: 70000,
    };

    const validated = validateScore(stoppedRun);
    expect(validated).not.toBeNull();
    expect(validated?.score).toBe(850);
    expect(validated?.distance).toBe(600);
    expect(validated?.zone).toBe(2);
  });
});

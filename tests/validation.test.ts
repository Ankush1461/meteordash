import { describe, expect, it } from "vitest";
import { validateScore } from "../lib/leaderboard";

// A run that passes every consistency rule: 1000 m at ~8.3 m/s over 120s,
// zone 3 (floor(1000/500)+1), combo ≤ 10, plausible collection rates and a
// bonus (500) the reported stats can pay (≤ 200/graze, ≤ 50/pickup, +500/boss).
function validRun(over: Record<string, unknown> = {}) {
  return {
    runId: "run-abc-123",
    name: "Tester",
    score: 1500,
    distance: 1000,
    zone: 3,
    maxCombo: 8,
    grazes: 40,
    powerUps: 8,
    bosses: 2,
    durationMs: 120000,
    ...over,
  };
}

describe("validateScore — accepts plausible runs", () => {
  it("accepts a valid run and sanitizes the name", () => {
    const entry = validateScore(validRun());
    expect(entry).not.toBeNull();
    expect(entry!.name).toBe("Tester");
    expect(entry!.score).toBe(1500);
    expect(entry!.distance).toBe(1000);
    expect(entry!.zone).toBe(3);
  });

  it("defaults an empty name to Pilot", () => {
    const entry = validateScore(validRun({ name: "  " }));
    expect(entry!.name).toBe("Pilot");
  });

  it("strips control characters and truncates the name to 16 chars", () => {
    const entry = validateScore(validRun({ name: "A\u0000B\u001fLongNameOverSixteenChars" }));
    expect(entry!.name.length).toBeLessThanOrEqual(16);
    expect(entry!.name).not.toContain("\u0000");
    expect(entry!.name).not.toContain("\u001f");
  });
});

describe("validateScore — rejects impossible runs", () => {
  it("rejects score < distance (score always includes distance)", () => {
    expect(validateScore(validRun({ score: 999, distance: 1000 }))).toBeNull();
  });

  it("rejects nonsense magnitudes", () => {
    expect(validateScore(validRun({ score: 5_000_001 }))).toBeNull();
    expect(validateScore(validRun({ distance: 1_000_001 }))).toBeNull();
  });

  it("rejects runs faster than the 10.5 m/s ceiling", () => {
    expect(validateScore(validRun({ distance: 1000, durationMs: 5000 }))).toBeNull();
  });

  it("rejects runs shorter than the 2s minimum duration", () => {
    expect(validateScore(validRun({ durationMs: 1000 }))).toBeNull();
  });

  it("rejects runs longer than 2 hours", () => {
    expect(validateScore(validRun({ durationMs: 2 * 60 * 60 * 1000 + 1 }))).toBeNull();
  });

  it("rejects combo above the hard cap of ×10", () => {
    expect(validateScore(validRun({ maxCombo: 11 }))).toBeNull();
  });

  it("rejects more bosses than zones exist", () => {
    expect(validateScore(validRun({ bosses: 6 }))).toBeNull();
  });

  it("rejects graze counts that outpace the frame rate", () => {
    expect(validateScore(validRun({ durationMs: 10000, grazes: 400 }))).toBeNull();
  });

  it("rejects power-up counts that outpace the spawn timer", () => {
    expect(validateScore(validRun({ durationMs: 10000, powerUps: 10 }))).toBeNull();
  });

  it("rejects a zone the distance could not have reached", () => {
    // 1000 m can only reach zone 3 — claiming zone 5 is impossible.
    expect(validateScore(validRun({ zone: 5 }))).toBeNull();
    // Zones only advance when a guardian is beaten, so a player who dies at
    // 1000 m without clearing the first boss is still legitimately in zone 1.
    expect(validateScore(validRun({ zone: 1 }))).not.toBeNull();
  });

  it("rejects a bonus the reported stats could not pay", () => {
    expect(
      validateScore(
        validRun({ grazes: 0, powerUps: 0, bosses: 0, score: 1500, distance: 1000 })
      )
    ).toBeNull();
  });

  it("rejects non-integer scores", () => {
    expect(validateScore(validRun({ score: 1500.5 }))).toBeNull();
  });

  it("rejects missing required fields", () => {
    const { runId: _drop, ...noRunId } = validRun();
    expect(validateScore(noRunId)).toBeNull();
    expect(validateScore({})).toBeNull();
    expect(validateScore(null)).toBeNull();
  });
});

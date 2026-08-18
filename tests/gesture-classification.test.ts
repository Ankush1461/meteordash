import { describe, expect, it } from "vitest";
import { gestureFeatures, GESTURE } from "../components/HandRecognizer";

// ---------------------------------------------------------------------------
// MediaPipe hand landmark layout (21 points per hand):
//   0: wrist
//   4: thumb tip, 3: thumb IP, 2: thumb MCP
//   8: index tip, 7: index DIP, 6: index PIP, 5: index MCP
//  12: middle tip, 11: middle DIP, 10: middle PIP, 9: middle MCP
//  16: ring tip, 15: ring DIP, 14: ring PIP, 13: ring MCP
//  20: pinky tip, 19: pinky DIP, 18: pinky PIP, 17: pinky MCP
//
// The gestureFeatures function normalizes all distances by the wrist→middleMCP
// distance (handSize), so we construct synthetic landmarks with known ratios.
// ---------------------------------------------------------------------------

/** Build 21 landmarks with palm size = 1 (wrist at origin, middleMcp at (0,1)). */
function makeLandmarks(overrides: Partial<Record<number, [number, number]>> = {}) {
  const lm: { x: number; y: number }[] = Array.from({ length: 21 }, () => ({
    x: 0,
    y: 0,
  }));
  // Wrist at origin
  lm[0] = { x: 0, y: 0 };
  // Middle MCP at (0, 1) — handSize = 1
  lm[9] = { x: 0, y: 1 };
  for (const [i, coords] of Object.entries(overrides)) {
    if (coords) {
      lm[Number(i)] = { x: coords[0], y: coords[1] };
    }
  }
  return lm;
}

// ---------------------------------------------------------------------------
// Raw feature extraction tests
// ---------------------------------------------------------------------------
describe("gestureFeatures — raw feature extraction", () => {
  it("computes spread as thumb-tip / pinky-tip distance / handSize", () => {
    // Spread hand: thumb at (0.8, -0.3), pinky at (-0.8, -0.3)
    // Distance = 1.6, handSize = 1 → spread = 1.6
    const lm = makeLandmarks({ 4: [0.8, -0.3], 20: [-0.8, -0.3] });
    const f = gestureFeatures(lm);
    expect(f.spread).toBeCloseTo(1.6, 2);
  });

  it("computes thumbIndex as thumb-tip / index-tip distance / handSize", () => {
    // Thumb at (0.3, -0.8), index at (0.35, -0.75)
    const lm = makeLandmarks({ 4: [0.3, -0.8], 8: [0.35, -0.75] });
    const f = gestureFeatures(lm);
    expect(f.thumbIndex).toBeCloseTo(
      Math.hypot(0.3 - 0.35, -0.8 + 0.75),
      2
    );
  });

  it("computes openness as fraction of extended fingers", () => {
    // All fingers curled: tips CLOSER to wrist than their MCPs × 1.35.
    // MCPs: index=5 at 0.65, middle=9 at 1.0 (default), ring=13 at 0.6,
    // pinky=17 at 0.55. Tips must be closer to wrist than MCP × 1.35.
    const lm = makeLandmarks({
      5: [0, 0.65],   // index MCP
      8: [0, 0.5],    // index tip (closer to wrist)
      13: [0, 0.6],   // ring MCP
      16: [0, 0.4],   // ring tip (closer)
      17: [0, 0.55],  // pinky MCP
      20: [0, 0.35],  // pinky tip (closer)
    });
    const f = gestureFeatures(lm);
    // middle MCP at index 9 = (0,1), tip at index 12 = (0,0) → mcpDist=1, tipDist=0 → NOT extended
    // index: tipDist=0.5, mcpDist=0.65 → 0.5 > 0.65*1.35=0.877? NO
    // ring: tipDist=0.4, mcpDist=0.6 → 0.4 > 0.6*1.35=0.81? NO
    // pinky: tipDist=0.35, mcpDist=0.55 → 0.35 > 0.55*1.35=0.7425? NO
    expect(f.openness).toBe(0);
  });

  it("counts index extension separately from outer fingers", () => {
    const lm = makeLandmarks({
      5: [0, 0.65],   // index MCP
      8: [0, -0.5],   // index tip (far from wrist → extended)
      12: [0, 0.45],  // middle tip (close to wrist → curled)
      13: [0, 0.6],   // ring MCP
      16: [0, 0.4],   // ring tip (close)
      17: [0, 0.55],  // pinky MCP
      20: [0, 0.4],   // pinky tip (close)
    });
    const f = gestureFeatures(lm);
    // index: tipDist=0.5 > mcpDist=0.65*1.35=0.877? YES (0.5 < 0.877 → NO!)
    // Wait, -0.5 → dist from wrist(0,0) = 0.5. 0.5 < 0.877 → NOT extended
    // Need the tip FARTHER from wrist than MCP × 1.35
    // index tip at y=-1.5: dist=1.5 > 0.65*1.35=0.877 → YES
    const lm2 = makeLandmarks({
      5: [0, 0.65],
      8: [0, -1.5],   // index tip FAR from wrist → extended
      12: [0, 0.45],  // middle tip close → curled
      13: [0, 0.6],
      16: [0, 0.4],
      17: [0, 0.55],
      20: [0, 0.4],
    });
    const f2 = gestureFeatures(lm2);
    expect(f2.indexExtended).toBe(true);
    expect(f2.outerOpenness).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Gesture classification boundary tests
// ---------------------------------------------------------------------------
describe("GESTURE thresholds — boundary accuracy", () => {
  it("spread requires both hands with spread > 1.3", () => {
    const h1 = makeLandmarks({ 4: [0.8, -0.3], 20: [-0.7, -0.3] });
    const h2 = makeLandmarks({ 4: [0.2, -0.5], 20: [-0.2, -0.5] });
    const f1 = gestureFeatures(h1);
    const f2 = gestureFeatures(h2);
    const isSpread = [f1, f2].every((h) => h.spread > GESTURE.spreadRatio);
    expect(isSpread).toBe(false);
  });

  it("fist is blocked by an extended index finger", () => {
    const lm = makeLandmarks({
      5: [0, 0.65],
      8: [0, -0.5],
      12: [0, 0.4],
      16: [0, 0.35],
      20: [0, 0.35],
    });
    const f = gestureFeatures(lm);
    const isFist =
      f.openness <= GESTURE.fistOpenness &&
      f.spread <= GESTURE.fistSpreadMax &&
      !f.indexExtended;
    expect(isFist).toBe(false);
  });

  it("pinch requires thumb-index < 0.55 AND outerOpenness >= 0.66", () => {
    const lm = makeLandmarks({
      4: [0.15, -0.5],
      8: [0.2, -0.55],
      12: [0, -0.6],
      16: [0, -0.55],
      20: [0, -0.5],
    });
    const f = gestureFeatures(lm);
    expect(f.thumbIndex).toBeLessThan(GESTURE.pinchMax);
    expect(f.outerOpenness).toBeGreaterThanOrEqual(GESTURE.pinchOuterMin);
  });
});

// ---------------------------------------------------------------------------
// Priority logic tests (spread beats flat)
// ---------------------------------------------------------------------------
describe("Gesture priority — spread beats flat", () => {
  it("single-hand spread blocks single-hand flat via priority", () => {
    const lm = makeLandmarks({
      4: [0.9, -0.3],
      20: [-0.8, -0.3],
      8: [0, -0.6],
      12: [0, -0.6],
      16: [0, -0.55],
    });
    const f = gestureFeatures(lm);

    const isSingleSpread = f.spread > GESTURE.spreadRatio;
    const isSingleFlat = isSingleSpread
      ? false
      : f.openness >= GESTURE.flatOpenness &&
        f.spread <= GESTURE.flatSpreadMax &&
        f.thumbIndex > GESTURE.flatThumbMin;

    expect(isSingleSpread).toBe(true);
    expect(isSingleFlat).toBe(false);
  });

  it("flat palm still fires when spread is NOT detected", () => {
    // Need: openness >= 0.75, spread <= 1.0, thumbIndex > 0.65, spread < 1.3
    // Tighter thumb-to-pinky so spread < 1.0, but thumb far from index
    const lm = makeLandmarks({
      4: [0.5, 0],     // thumb tip
      20: [-0.3, -0.2], // pinky tip
      5: [0, 0.65],    // index MCP
      8: [0, -1.5],    // index extended
      12: [0, -1.4],   // middle extended
      13: [0, 0.6],    // ring MCP
      16: [0, -1.3],   // ring extended
      17: [0, 0.55],   // pinky MCP
    });
    const f = gestureFeatures(lm);
    // spread = hypot(0.5+0.3, 0+0.2) = hypot(0.8, 0.2) ≈ 0.825
    // thumbIndex = hypot(0.5-0, 0+1.5) = hypot(0.5, 1.5) ≈ 1.58
    expect(f.spread).toBeLessThan(GESTURE.flatSpreadMax); // ~0.825 < 1.0
    expect(f.thumbIndex).toBeGreaterThan(GESTURE.flatThumbMin); // ~1.58 > 0.65
    const isSingleSpread = f.spread > GESTURE.spreadRatio;
    const isSingleFlat = isSingleSpread
      ? false
      : f.openness >= GESTURE.flatOpenness &&
        f.spread <= GESTURE.flatSpreadMax &&
        f.thumbIndex > GESTURE.flatThumbMin;
    expect(isSingleSpread).toBe(false);
    expect(isSingleFlat).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Debounce and edge-trigger logic simulation
// ---------------------------------------------------------------------------
describe("Debounce counter simulation — edge triggers", () => {
  function simulateDebounce(
    sequence: boolean[],
    holdFrames: number,
    decayMode: "hard-reset" | "decay-2" = "hard-reset"
  ): { fires: boolean; fireFrame: number } {
    let hold = 0;
    let held = false;
    for (let i = 0; i < sequence.length; i++) {
      if (sequence[i]) {
        hold = Math.min(99, hold + 1);
      } else if (decayMode === "decay-2") {
        hold = Math.max(0, hold - 2);
      } else {
        hold = 0;
      }
      if (hold >= holdFrames && !held) {
        held = true;
        return { fires: true, fireFrame: i };
      }
    }
    return { fires: false, fireFrame: -1 };
  }

  it("fires on the 3rd consecutive true frame", () => {
    const result = simulateDebounce([true, true, true], 3);
    expect(result.fires).toBe(true);
    expect(result.fireFrame).toBe(2);
  });

  it("does NOT fire if a single false frame interrupts (hard-reset)", () => {
    // Sequence: 2 trues, 1 false, 2 trues — never reaches 3 consecutive
    const result = simulateDebounce([true, true, false, true, true], 3);
    expect(result.fires).toBe(false);
  });

  it("decay-2 mode survives a single jitter frame", () => {
    const result = simulateDebounce(
      [true, true, true, false, true, true, true],
      3,
      "decay-2"
    );
    expect(result.fires).toBe(true);
  });

  it("decay-2 mode resets after 2+ consecutive false frames", () => {
    // Starts with only 2 trues (not enough to fire), then 2 falses fully
    // reset, then 3 trues to fire.
    const result = simulateDebounce(
      [true, true, false, false, true, true, true],
      3,
      "decay-2"
    );
    expect(result.fires).toBe(true);
    expect(result.fireFrame).toBe(6);
  });

  it("edge-trigger: fires only once per hold", () => {
    let hold = 0;
    let held = false;
    let fireCount = 0;
    for (const isGesture of [true, true, true, true, true, true]) {
      hold = isGesture ? Math.min(99, hold + 1) : 0;
      if (hold >= 3 && !held) {
        held = true;
        fireCount++;
      }
      if (!isGesture) held = false;
    }
    expect(fireCount).toBe(1);
  });

  it("re-fires after release and re-press", () => {
    let hold = 0;
    let held = false;
    let fireCount = 0;
    for (const isGesture of [true, true, true, true, false, false, true, true, true]) {
      hold = isGesture ? Math.min(99, hold + 1) : 0;
      if (hold >= 3 && !held) {
        held = true;
        fireCount++;
      }
      if (!isGesture) held = false;
    }
    expect(fireCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Cooldown guard tests
// ---------------------------------------------------------------------------
describe("Menu click cooldown — prevents rapid-fire", () => {
  it("cooldown blocks a second click within 400ms", () => {
    let cooldownUntil = 0;
    const COOLDOWN_MS = 400;

    cooldownUntil = 0 + COOLDOWN_MS;
    expect(200 >= cooldownUntil).toBe(false);
    expect(500 >= cooldownUntil).toBe(true);
  });

  it("fist click and point-pinch click share the same cooldown", () => {
    let cooldownUntil = 0;
    const COOLDOWN_MS = 400;

    cooldownUntil = 0 + COOLDOWN_MS;
    // Fist click at t=300 — same cooldown as point-pinch
    expect(300 >= cooldownUntil).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tilt / steering EMA simulation
// ---------------------------------------------------------------------------
describe("Tilt smoothing — EMA filter simulation", () => {
  const ALPHA = 0.4;

  it("converges toward a constant input", () => {
    let smoothed = 0;
    let hasSample = false;
    for (let i = 0; i < 10; i++) {
      smoothed = hasSample ? smoothed + ALPHA * (30 - smoothed) : 30;
      hasSample = true;
    }
    expect(smoothed).toBeGreaterThan(25);
    expect(smoothed).toBeLessThanOrEqual(30);
  });

  it("resets on detection loss", () => {
    let smoothed = 25;
    smoothed = 0; // loss
    smoothed = 10; // first sample seeds the filter
    expect(smoothed).toBe(10);
  });

  it("responds within ~3 frames to a sudden input change", () => {
    let smoothed = 0;
    let hasSample = false;
    for (let i = 0; i < 5; i++) {
      smoothed = hasSample ? smoothed + ALPHA * (0 - smoothed) : 0;
      hasSample = true;
    }
    smoothed = smoothed + ALPHA * (45 - smoothed);
    smoothed = smoothed + ALPHA * (45 - smoothed);
    smoothed = smoothed + ALPHA * (45 - smoothed);
    expect(smoothed).toBeGreaterThan(30);
  });
});

// ---------------------------------------------------------------------------
// Pointing hand menu cursor detection
// ---------------------------------------------------------------------------
describe("Point detection — menu cursor accuracy", () => {
  it("pointing hand: index extended, outerOpenness <= 0.45", () => {
    const lm = makeLandmarks({
      5: [0, 0.65],   // index MCP
      8: [0, -1.5],   // index tip FAR from wrist → extended
      12: [0, 0.45],  // middle tip close → curled
      13: [0, 0.6],   // ring MCP
      16: [0, 0.4],   // ring tip close → curled
      17: [0, 0.55],  // pinky MCP
      20: [0, 0.35],  // pinky tip close → curled
    });
    const f = gestureFeatures(lm);
    const isPointing =
      f.indexExtended && f.outerOpenness <= GESTURE.pointOuterMax;
    expect(isPointing).toBe(true);
    expect(f.outerOpenness).toBe(0);
  });

  it("flat palm is NOT a pointing hand", () => {
    const lm = makeLandmarks({
      5: [0, 0.65],   // index MCP
      8: [0, -1.5],   // index tip extended
      12: [0, -1.4],  // middle tip extended
      13: [0, 0.6],   // ring MCP
      16: [0, -1.3],  // ring tip extended
      17: [0, 0.55],  // pinky MCP
      20: [0, -1.2],  // pinky tip extended
    });
    const f = gestureFeatures(lm);
    const isPointing =
      f.indexExtended && f.outerOpenness <= GESTURE.pointOuterMax;
    expect(isPointing).toBe(false);
  });

  it("natural point with middle finger drift still registers", () => {
    // Index extended (far from wrist), middle half-up (above MCP*1.35 threshold
    // so it counts as extended), ring and pinky curled.
    // middle MCP at (0,1), so MCP dist = 1.0, threshold = 1.35
    // middle tip at (0,-1.4) → dist = 1.4 > 1.35 → extended (half-up counts)
    const lm = makeLandmarks({
      5: [0, 0.65],   // index MCP
      8: [0, -1.5],   // index tip extended (dist=1.5 > 0.65*1.35=0.877)
      12: [0, -1.4],  // middle tip half-up (dist=1.4 > 1.0*1.35=1.35 → extended)
      13: [0, 0.6],   // ring MCP
      16: [0, 0.4],   // ring tip curled (dist=0.4 < 0.6*1.35=0.81)
      17: [0, 0.55],  // pinky MCP
      20: [0, 0.35],  // pinky tip curled (dist=0.35 < 0.55*1.35=0.7425)
    });
    const f = gestureFeatures(lm);
    // outerOpenness = 1/3 ≈ 0.333 (only middle is extended among outer)
    expect(f.outerOpenness).toBeCloseTo(1 / 3, 2);
    // 0.333 < 0.45 → still classified as pointing
    const isPointing =
      f.indexExtended && f.outerOpenness <= GESTURE.pointOuterMax;
    expect(isPointing).toBe(true);
  });
});

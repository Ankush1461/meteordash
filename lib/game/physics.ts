import {
  MIN_FALL_DURATION,
  REF_WIDTH,
  SCALE_MIN,
  SCALE_MAX,
  SIZE_SCALE_MIN,
  SIZE_SCALE_MAX,
} from "./constants";

// Meteor fall duration (seconds) shrinks as the run gets deeper, so the
// belt speeds up with distance. Log falloff keeps it fair at high depth.
export function fallDuration(distance: number): number {
  if (distance <= 50) return 10;
  return Math.max(MIN_FALL_DURATION, 10 - Math.log2(distance / 50));
}

// --- Responsive gameplay scaling ---------------------------------------
// All three helpers compare the live viewport against the 1280×800 reference
// so a run feels identical on a phone and an ultrawide: same meteor density
// per unit width, same tilt→field-fraction steering, same fall time.

// During SSR/prerender there is no window — return the reference scale (1)
// so the initial HTML uses reference sizes and the client hydrates the real
// values on mount (gameplay helpers only run inside the client rAF loop).
const hasWindow = typeof window !== "undefined";

/** Gameplay scale — speeds, densities and hit areas. */
export function gameplayScale(): number {
  if (!hasWindow) return 1;
  return Math.min(
    SCALE_MAX,
    Math.max(SCALE_MIN, window.innerWidth / REF_WIDTH)
  );
}

/** Gentler scale for sprite sizes, clamped for visibility. */
export function spriteScale(): number {
  if (!hasWindow) return 1;
  return Math.min(
    SIZE_SCALE_MAX,
    Math.max(SIZE_SCALE_MIN, window.innerWidth / REF_WIDTH)
  );
}

/** Vertical fall speed that crosses any screen in `fallDuration` seconds. */
export function fallSpeed(distance: number): number {
  if (!hasWindow) return 2100 / fallDuration(distance);
  return (window.innerHeight + 250) / fallDuration(distance);
}

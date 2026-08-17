"use client";

import { useMemo, type CSSProperties } from "react";

const COLORS = [
  "#fbbf24",
  "#f87171",
  "#34d399",
  "#38bdf8",
  "#c084fc",
  "#fde047",
];

// Deterministic PRNG (mulberry32) so randomness never runs during render —
// the seed arrives from the caller, generated in an async callback.
function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One-shot confetti burst: a screen of small colored pieces that fall and
 * fade via CSS keyframes (confetti-fall in globals.css). Mounted fresh per
 * burst (keyed by seed) and left in place — pieces end fully transparent
 * and inert.
 */
export default function ConfettiBurst({
  seed,
  count = 36,
}: {
  seed: number;
  count?: number;
}) {
  const pieces = useMemo(() => {
    const rand = mulberry32(seed);
    return Array.from({ length: count }, (_, i) => ({
      left: rand() * 100,
      delay: rand() * 0.15,
      duration: 0.8 + rand() * 0.6,
      size: 6 + rand() * 6,
      color: COLORS[i % COLORS.length],
      sway: `${Math.round(rand() * 120 - 60)}px`,
      rot: `${Math.round(rand() * 540 - 270)}deg`,
    }));
  }, [count, seed]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.45,
            backgroundColor: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            "--confetti-sway": p.sway,
            "--confetti-rot": p.rot,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

import type { BossProjectile, BossStyle } from "./types";

// Each zone's guardian layers a themed aura, glow and accessory over the
// shared meteor sprite so bosses look distinct, not just re-tinted.
export const BOSS_STYLES: BossStyle[] = [
  {
    aura: "rgba(248, 113, 113, 0.38) 0%, rgba(248, 113, 113, 0.12) 55%, transparent 72%",
    auraSize: 280,
    glowRgb: "248, 113, 113",
    accessory: "orbit",
  },
  {
    aura: "rgba(192, 132, 252, 0.38) 0%, rgba(192, 132, 252, 0.12) 55%, transparent 72%",
    auraSize: 300,
    glowRgb: "192, 132, 252",
    accessory: "none",
  },
  {
    aura: "rgba(56, 189, 248, 0.38) 0%, rgba(56, 189, 248, 0.12) 55%, transparent 72%",
    auraSize: 300,
    glowRgb: "56, 189, 248",
    accessory: "none",
  },
  {
    aura: "rgba(251, 146, 60, 0.38) 0%, rgba(251, 146, 60, 0.12) 55%, transparent 72%",
    auraSize: 300,
    glowRgb: "251, 146, 60",
    accessory: "none",
  },
  {
    aura: "rgba(167, 139, 250, 0.38) 0%, rgba(167, 139, 250, 0.12) 55%, transparent 72%",
    auraSize: 310,
    glowRgb: "167, 139, 250",
    accessory: "void",
  },
];

export function getBossStyle(zoneNumber: number): BossStyle {
  return BOSS_STYLES[(zoneNumber - 1) % BOSS_STYLES.length];
}

// Each guardian has its own body. The Asteroid Field keeps a rough rock,
// and the other zones use their own art (public/Images/boss-*.png).
export const BOSS_SPRITES = [
  "/Images/boss-asteroid.png", // Asteroid Field - rough big asteroid
  "/Images/boss-nebula.png", // Nebula Storm - dying star
  "/Images/boss-neptune.png", // Ice Field - Neptune gas giant
  "/Images/boss-lava.png", // Lava Belt - sun
  "/Images/boss-void.png", // The Void - black hole
];

export function bossDuration(bossIndex: number): number {
  return Math.max(6, 26 - bossIndex * 2);
}

// Per-zone guardian difficulty tuning. The Asteroid Field (index 0) and
// Lava Belt (index 3) guardians are the bruisers of the run: more HP, faster
// volleys, denser patterns, and more aggressive movement than the others.
// hp multiplies the fight length (1.25 = 25% longer), interval is the
// seconds between volleys, swaySpeed/width make the guardian drift faster
// and across a wider band of the screen.
export const BOSS_TUNING = [
  { hp: 1.25, interval: 1.9, swaySpeed: 1.0, swayWidth: 1.25 }, // Asteroid Field
  { hp: 1.0, interval: 3.2, swaySpeed: 1.0, swayWidth: 1.0 }, // Nebula Storm
  { hp: 1.0, interval: 2.4, swaySpeed: 1.0, swayWidth: 1.0 }, // Ice Field
  { hp: 1.35, interval: 1.6, swaySpeed: 1.3, swayWidth: 1.1 }, // Lava Belt
  { hp: 1.0, interval: 3.0, swaySpeed: 1.0, swayWidth: 1.0 }, // The Void
] as const;

// Per-kind projectile visuals (bolt is the fallback generic shot). The
// themed attacks use procedurally generated sprites (public/Images/proj-*)
// - irregular, lit rock / translucent ice / molten ember - that tumble via
// a CSS spin on the inner div, so the rAF loop only moves the outer
// positioned element each frame.
export function bossProjectileStyle(p: BossProjectile) {
  switch (p.kind) {
    case "rock":
      return {
        backgroundImage: "url(/Images/proj-rock.png)",
        backgroundSize: "100% 100%",
        filter: "drop-shadow(0 0 6px rgba(148, 148, 158, 0.55))",
        animation: "projSpin 2.4s linear infinite",
      };
    case "shard":
      return {
        backgroundImage: "url(/Images/proj-shard.png)",
        backgroundSize: "100% 100%",
        filter: "drop-shadow(0 0 6px rgba(103, 232, 249, 0.8))",
        animation: "projSpin 3.2s linear infinite reverse",
      };
    case "lava":
      return {
        backgroundImage: "url(/Images/proj-lava.png)",
        backgroundSize: "100% 100%",
        filter: "drop-shadow(0 0 10px rgba(251, 146, 60, 0.85))",
        animation: "projSpin 1.5s linear infinite",
      };
    case "orb":
      return {
        background: "radial-gradient(circle at 50% 45%, #a78bfa, #4c1d95)",
        boxShadow: "0 0 12px 4px rgba(167, 139, 250, 0.55)",
      };
    default:
      return {
        backgroundColor: "#fb7185",
        boxShadow: "0 0 14px 5px rgba(251, 113, 133, 0.65)",
      };
  }
}

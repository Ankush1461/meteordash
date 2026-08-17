import type { BossAccessoryKind } from "@/components/BossAccessory";

export type ZoneTheme = {
  name: string;
  bg: string;
  meteorFilter: string;
  accent: string;
};

// Each zone doubles as a story chapter: a mission brief shown when the run
// enters the zone, and a celebration when its guardian falls.
export type ZoneStory = {
  chapter: string;
  objective: string;
};

export type BossStyle = {
  aura: string;
  auraSize: number;
  glowRgb: string;
  accessory: BossAccessoryKind;
};

export type BossProjectile = {
  key: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hit: boolean;
  /** Which guardian fired this projectile (drives its look + behavior). */
  kind: "bolt" | "rock" | "shard" | "lava" | "orb";
  /** Downward acceleration for lobbed/dropped rocks. */
  gravity?: number;
};

export type Banner = {
  title: string;
  subtitle?: string;
  objective?: string;
  variant?: "zone" | "clear";
};

export type Bolt = {
  key: string;
  x: number;
  y: number;
  /** 0–1 charge; charged bolts are bigger, score more and hit the boss harder. */
  charge: number;
  size: number;
  hit: boolean;
};

export type PowerUpType = "shield" | "slowmo" | "double" | "life";

export type PowerUp = {
  key: string;
  x: number;
  y: number;
  size: number;
  speed: number;
  rotation: number;
  type: PowerUpType;
  hit: boolean;
};

export type ScorePopup = {
  key: string;
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
  color: string;
};

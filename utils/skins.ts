"use client";
import Cookies from "js-cookie";
import type { BadgeId } from "@/utils/badges";

export type SkinId =
  | "classic"
  | "hunter"
  | "dasher"
  | "combo"
  | "guardian"
  | "marathon"
  | "void"
  | "legend";

export type RocketSkin = {
  id: SkinId;
  name: string;
  description: string;
  unlockHint: string;
  /** null = always available; badge = needs that badge; score = high-score milestone. */
  unlock: null | { kind: "badge"; badge: BadgeId } | { kind: "score"; score: number };
  body: string;
  bodyDark: string;
  window: string;
  flame: string;
  glow: string;
};

export const SKINS: RocketSkin[] = [
  {
    id: "classic",
    name: "Classic",
    description: "The original red-and-white workhorse.",
    unlockHint: "Unlocked by default",
    unlock: null,
    body: "#ef4444",
    bodyDark: "#b91c1c",
    window: "#bae6fd",
    flame: "#fbbf24",
    glow: "#ef4444",
  },
  {
    id: "hunter",
    name: "Hunter",
    description: "A stealth-green hull for pilots who live on the edge of a graze.",
    unlockHint: "Earn the Grazer badge",
    unlock: { kind: "badge", badge: "graze" },
    body: "#16a34a",
    bodyDark: "#14532d",
    window: "#bbf7d0",
    flame: "#4ade80",
    glow: "#4ade80",
  },
  {
    id: "dasher",
    name: "Dasher",
    description: "Built for speed — the rocket the dash gesture was made for.",
    unlockHint: "Earn the Dasher badge",
    unlock: { kind: "badge", badge: "dash" },
    body: "#0284c7",
    bodyDark: "#075985",
    window: "#e0f2fe",
    flame: "#7dd3fc",
    glow: "#38bdf8",
  },
  {
    id: "combo",
    name: "Combo Star",
    description: "A gold hull for pilots who chain ten grazes and never look back.",
    unlockHint: "Earn the Combo 10 badge",
    unlock: { kind: "badge", badge: "combo10" },
    body: "#f59e0b",
    bodyDark: "#92400e",
    window: "#fef3c7",
    flame: "#fde047",
    glow: "#facc15",
  },
  {
    id: "guardian",
    name: "Guardian Slayer",
    description: "Forged from the wreckage of your first defeated guardian.",
    unlockHint: "Defeat a zone guardian",
    unlock: { kind: "badge", badge: "boss" },
    body: "#dc2626",
    bodyDark: "#450a0a",
    window: "#fecaca",
    flame: "#fb923c",
    glow: "#f87171",
  },
  {
    id: "marathon",
    name: "Marathon",
    description: "Worn down by 500 metres of asteroid dust.",
    unlockHint: "Fly 500m in a single run",
    unlock: { kind: "badge", badge: "marathon" },
    body: "#7c3aed",
    bodyDark: "#2e1065",
    window: "#ede9fe",
    flame: "#c084fc",
    glow: "#a78bfa",
  },
  {
    id: "void",
    name: "Void Racer",
    description: "A near-black racer for pilots who've crossed 10,000 points.",
    unlockHint: "Reach a 10,000 high score",
    unlock: { kind: "score", score: 10000 },
    body: "#334155",
    bodyDark: "#0f172a",
    window: "#c4b5fd",
    flame: "#a78bfa",
    glow: "#818cf8",
  },
  {
    id: "legend",
    name: "Legend",
    description: "The 25,000-point legend. Only the best fly gold.",
    unlockHint: "Reach a 25,000 high score",
    unlock: { kind: "score", score: 25000 },
    body: "#fbbf24",
    bodyDark: "#b45309",
    window: "#fff7ed",
    flame: "#f87171",
    glow: "#fbbf24",
  },
];

const SKINS_COOKIE = "rocketSkin";

export function getSkin(id: SkinId): RocketSkin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

export function isSkinUnlocked(
  skin: RocketSkin,
  unlockedBadges: BadgeId[],
  highScore: number
): boolean {
  if (skin.unlock === null) return true;
  if (skin.unlock.kind === "badge") {
    return unlockedBadges.includes(skin.unlock.badge);
  }
  return highScore >= skin.unlock.score;
}

export function readSelectedSkin(): SkinId {
  const raw = Cookies.get(SKINS_COOKIE);
  if (raw && SKINS.some((s) => s.id === raw)) {
    return raw as SkinId;
  }
  return "classic";
}

export function saveSelectedSkin(id: SkinId) {
  Cookies.set(SKINS_COOKIE, id, { expires: 365 });
}

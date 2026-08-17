"use client";
import {
  Flame,
  Lock,
  MapPin,
  Shield,
  Trophy,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Cookies from "js-cookie";

export type BadgeId =
  | "graze"
  | "dash"
  | "shield"
  | "combo10"
  | "boss"
  | "marathon";

export type BadgeDef = {
  id: BadgeId;
  /** Short label shown under the badge icon. */
  name: string;
  description: string;
  color: string;
  icon: LucideIcon;
};

export const BADGES: BadgeDef[] = [
  {
    id: "graze",
    name: "Grazer",
    description: "Earn your first near-miss graze",
    color: "#4ade80",
    icon: Wind,
  },
  {
    id: "dash",
    name: "Dasher",
    description: "Trigger your first dash",
    color: "#7dd3fc",
    icon: Zap,
  },
  {
    id: "shield",
    name: "Shield",
    description: "Grab your first shield power-up",
    color: "#38bdf8",
    icon: Shield,
  },
  {
    id: "combo10",
    name: "Combo 10",
    description: "Reach a 10× combo streak",
    color: "#facc15",
    icon: Flame,
  },
  {
    id: "boss",
    name: "Boss Slayer",
    description: "Defeat a zone guardian",
    color: "#f87171",
    icon: Trophy,
  },
  {
    id: "marathon",
    name: "500m",
    description: "Fly 500 metres in a single run",
    color: "#c084fc",
    icon: MapPin,
  },
];

const BADGES_COOKIE = "badges";

export function readUnlockedBadges(): BadgeId[] {
  try {
    const raw = Cookies.get(BADGES_COOKIE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (id): id is BadgeId =>
        typeof id === "string" && BADGES.some((b) => b.id === id)
    );
  } catch {
    return [];
  }
}

export function saveUnlockedBadges(ids: BadgeId[]) {
  Cookies.set(BADGES_COOKIE, JSON.stringify(ids), { expires: 365 });
}

export function BadgeIcon({ id, locked }: { id: BadgeId; locked: boolean }) {
  const def = BADGES.find((b) => b.id === id);
  if (!def) return null;
  const Icon = def.icon;
  return (
    <span
      className="relative flex h-11 w-11 items-center justify-center rounded-full border-2"
      style={{
        borderColor: locked ? "#57534e" : def.color,
        backgroundColor: locked ? "#1c1917" : `${def.color}1f`,
        color: locked ? "#78716c" : def.color,
      }}
      title={def.description}
      aria-label={def.description}
    >
      <Icon size={20} />
      {locked && <Lock size={11} className="absolute -bottom-0.5 -right-0.5" />}
    </span>
  );
}

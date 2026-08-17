import type { ZoneStory, ZoneTheme } from "./types";

export const ZONE_THEMES: ZoneTheme[] = [
  {
    name: "Asteroid Field",
    bg: "rgba(10, 20, 45, 0.5)",
    meteorFilter: "sepia(0.1) saturate(1)",
    accent: "#f87171",
  },
  {
    name: "Nebula Storm",
    bg: "rgba(55, 12, 75, 0.55)",
    meteorFilter: "sepia(0.7) hue-rotate(235deg) saturate(1.6)",
    accent: "#c084fc",
  },
  {
    name: "Ice Field",
    bg: "rgba(8, 42, 78, 0.55)",
    meteorFilter: "sepia(0.6) hue-rotate(175deg) saturate(1.4) brightness(1.25)",
    accent: "#38bdf8",
  },
  {
    name: "Lava Belt",
    bg: "rgba(80, 22, 6, 0.55)",
    meteorFilter: "sepia(0.8) hue-rotate(-10deg) saturate(2.2) brightness(1.05)",
    accent: "#fb923c",
  },
  {
    name: "The Void",
    bg: "rgba(35, 10, 55, 0.6)",
    meteorFilter: "sepia(0.75) hue-rotate(265deg) saturate(1.5) brightness(0.8)",
    accent: "#a78bfa",
  },
];

export const ZONE_STORIES: ZoneStory[] = [
  {
    chapter: "The Gauntlet",
    objective: "Thread the belt — the first Guardian bars the way out.",
  },
  {
    chapter: "Dying Light",
    objective: "Cross the dying star's storm before it swallows you.",
  },
  {
    chapter: "Frozen Reach",
    objective: "Slip past the frost giant without freezing solid.",
  },
  {
    chapter: "The Furnace",
    objective: "Brave the sun's corona while embers rain from above.",
  },
  {
    chapter: "Event Horizon",
    objective: "Escape the black hole's pull before it claims you.",
  },
];

export function getZone(zoneNumber: number): ZoneTheme {
  return ZONE_THEMES[(zoneNumber - 1) % ZONE_THEMES.length];
}

export function getZoneStory(zoneNumber: number): ZoneStory {
  return ZONE_STORIES[(zoneNumber - 1) % ZONE_STORIES.length];
}

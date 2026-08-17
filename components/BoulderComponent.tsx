import Image from "next/image";
import React, { memo } from "react";

export type Boulder = {
  key: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  speed: number;
  hit: boolean;
  /** True once this meteor has been grazed (near-miss) — only rewards once. */
  grazed: boolean;
  /** Which meteor sprite variant to render (0-2) — adds belt variety. */
  variant: number;
};

// Three seed-varied cratered rocks so the belt doesn't look copy-pasted.
const METEOR_SPRITES = [
  "/Images/meteor.png",
  "/Images/meteor-2.png",
  "/Images/meteor-3.png",
];

type Props = {
  boulder: Boulder;
  registerEl: (key: string, el: HTMLDivElement | null) => void;
  /** CSS filter tinting the meteor for the current zone theme. */
  filter?: string;
};

/**
 * Presentational meteor. Physics, collision detection and off-screen
 * despawning are handled by the requestAnimationFrame loop in page.tsx,
 * which moves this element by mutating its transform directly — so this
 * component never re-renders while a boulder is falling.
 */
const BoulderComponent = memo(function BoulderComponent({
  boulder,
  registerEl,
  filter = "none",
}: Props) {
  return (
    <div
      ref={(el) => registerEl(boulder.key, el)}
      className="boulder-shadow"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: boulder.size,
        height: boulder.size,
        transform: `translate3d(${boulder.x}px, ${boulder.y}px, 0) rotate(${boulder.rotation}deg)`,
      }}
    >
      <Image
        src={METEOR_SPRITES[boulder.variant % METEOR_SPRITES.length]}
        width={boulder.size}
        height={boulder.size}
        alt={""}
        style={{
          // Pin both rendered dimensions like the boss sprite: Tailwind's
          // preflight `img { height: auto }` would otherwise size the height
          // from the non-square meteor sheet's intrinsic ratio, which trips
          // Next's aspect-ratio warning whenever a boulder size is an exact
          // integer (e.g. the tutorial's 70px demo rock).
          width: boulder.size,
          height: boulder.size,
          filter,
        }}
      />
    </div>
  );
});

export default BoulderComponent;

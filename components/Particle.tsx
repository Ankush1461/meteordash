import React, { memo } from "react";

export type ParticleData = {
  key: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  rotation: number;
  rotSpeed: number;
  /** "shard" renders a small triangular ice sliver instead of a round spark. */
  shape?: "circle" | "shard";
  /** Downward acceleration (px/s²) — debris/chunks fall realistically. */
  gravity?: number;
  /** Growth rate (px/s) — smoke and flame expand as they age. */
  growth?: number;
  /** "ring" renders an expanding shockwave outline instead of a filled dot. */
  ring?: boolean;
};

type Props = {
  particle: ParticleData;
  registerEl: (key: string, el: HTMLDivElement | null) => void;
};

/**
 * A single particle (explosion spark or engine trail). Physics, fading and
 * despawning are handled by the rAF loop in page.tsx, which moves it by
 * mutating its transform/opacity directly — so this never re-renders while
 * a particle is alive.
 */
const Particle = memo(function Particle({ particle, registerEl }: Props) {
  return (
    <div
      ref={(el) => registerEl(particle.key, el)}
      className={`absolute pointer-events-none ${
        particle.shape === "shard" ? "" : "rounded-full"
      }`}
      style={{
        left: 0,
        top: 0,
        width: particle.size,
        height: particle.size,
        backgroundColor: particle.ring ? "transparent" : particle.color,
        border: particle.ring
          ? `2.5px solid ${particle.color}`
          : undefined,
        clipPath:
          particle.shape === "shard"
            ? "polygon(50% 0%, 0% 100%, 100% 100%)"
            : undefined,
        opacity: 1,
        transform: `translate3d(${particle.x}px, ${particle.y}px, 0) rotate(${particle.rotation}deg)`,
      }}
    />
  );
});

export default Particle;

import React, { useId } from "react";
import type { RocketSkin } from "@/utils/skins";

/** Lighten (amt > 0) or darken (amt < 0) a hex color; amt in [-1, 1]. */
function shade(hexColor: string, amt: number): string {
  const h = hexColor.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const target = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const mix = (c: number) => Math.round(c + (target - c) * p);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

type SpriteProps = {
  skin: RocketSkin;
  size?: number;
};

/**
 * The rocket hull as a small shaded SVG so every skin can recolor the body,
 * window, fins and flame. Realism touches: lit-from-above hull gradient,
 * metallic nose cone + engine bell, glass dome with a reflection, panel
 * lines and rivets, and a three-layer flickering exhaust plume with a glow.
 */
export const RocketSprite = ({ skin, size = 35 }: SpriteProps) => {
  // Unique gradient IDs per instance (the lives HUD and picker render many).
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const hullGrad = `${uid}-hull`;
  const noseGrad = `${uid}-nose`;
  const finGrad = `${uid}-fin`;
  const bellGrad = `${uid}-bell`;
  const winGrad = `${uid}-win`;
  const glowGrad = `${uid}-glow`;

  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true">
      <defs>
        <linearGradient id={hullGrad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={shade(skin.body, 0.45)} />
          <stop offset="55%" stopColor={skin.body} />
          <stop offset="100%" stopColor={shade(skin.body, -0.32)} />
        </linearGradient>
        <linearGradient id={noseGrad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={shade(skin.bodyDark, 0.3)} />
          <stop offset="100%" stopColor={shade(skin.bodyDark, -0.35)} />
        </linearGradient>
        <linearGradient id={finGrad} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor={shade(skin.body, 0.2)} />
          <stop offset="100%" stopColor={shade(skin.bodyDark, -0.25)} />
        </linearGradient>
        <linearGradient id={bellGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(skin.bodyDark, 0.25)} />
          <stop offset="100%" stopColor={shade(skin.bodyDark, -0.4)} />
        </linearGradient>
        <radialGradient id={winGrad} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor={shade(skin.window, 0.5)} />
          <stop offset="100%" stopColor={shade(skin.window, -0.2)} />
        </radialGradient>
        <radialGradient id={glowGrad} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={skin.flame} stopOpacity="0.55" />
          <stop offset="100%" stopColor={skin.flame} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Exhaust glow behind the plume */}
      <ellipse
        cx="22"
        cy="38.5"
        rx="8.5"
        ry="7"
        fill={`url(#${glowGrad})`}
      />

      {/* Three-layer flame: outer, mid, hot core (flicker out of phase) */}
      <path
        className="rocket-flame"
        style={{ animationDelay: "0s" }}
        d="M22 34 C17.8 38.2 17.8 41.5 22 44 C26.2 41.5 26.2 38.2 22 34 Z"
        fill={skin.flame}
      />
      <path
        className="rocket-flame"
        style={{ animationDelay: "0.09s" }}
        d="M22 34 C19.4 37.4 19.4 40 22 42.4 C24.6 40 24.6 37.4 22 34 Z"
        fill={shade(skin.flame, 0.35)}
      />
      <path
        className="rocket-flame"
        style={{ animationDelay: "0.16s" }}
        d="M22 34 C20.5 36.6 20.5 38.6 22 40.4 C23.5 38.6 23.5 36.6 22 34 Z"
        fill="#ffffff"
        opacity="0.9"
      />

      {/* Fins (swept, metallic) */}
      <path
        d="M14.8 19.5 L8.6 32.5 L14.8 30.4 Z"
        fill={`url(#${finGrad})`}
        stroke={shade(skin.bodyDark, -0.3)}
        strokeWidth="0.6"
      />
      <path
        d="M14.8 19.5 L8.6 32.5"
        stroke={shade(skin.body, 0.35)}
        strokeWidth="0.5"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M29.2 19.5 L35.4 32.5 L29.2 30.4 Z"
        fill={`url(#${finGrad})`}
        stroke={shade(skin.bodyDark, -0.3)}
        strokeWidth="0.6"
      />
      <path
        d="M29.2 19.5 L35.4 32.5"
        stroke={shade(skin.body, 0.35)}
        strokeWidth="0.5"
        fill="none"
        opacity="0.6"
      />

      {/* Engine bell + rim */}
      <path
        d="M18.4 29.2 L16.6 34.5 L27.4 34.5 L25.6 29.2 Z"
        fill={`url(#${bellGrad})`}
        stroke={shade(skin.bodyDark, -0.4)}
        strokeWidth="0.6"
      />
      <rect
        x="16.3"
        y="34.3"
        width="11.4"
        height="1.1"
        rx="0.55"
        fill={shade(skin.bodyDark, -0.35)}
      />

      {/* Hull with lit-from-above shading */}
      <path
        d="M22 2 C16 10.5 14.6 19 14.6 30 L29.4 30 C29.4 19 28 10.5 22 2 Z"
        fill={`url(#${hullGrad})`}
        stroke={shade(skin.bodyDark, -0.35)}
        strokeWidth="0.8"
      />
      {/* Specular streak down the lit side */}
      <path
        d="M17.3 7.5 C16.2 13 15.5 19 15.3 23.5 L16.7 23.5 C17.1 18.5 17.9 12.5 19.4 7.8 Z"
        fill="#ffffff"
        opacity="0.16"
      />

      {/* Nose cone + metallic ring */}
      <path
        d="M22 2 C19.6 6 18.6 9.5 18.3 13 L25.7 13 C25.4 9.5 24.4 6 22 2 Z"
        fill={`url(#${noseGrad})`}
        stroke={shade(skin.bodyDark, -0.4)}
        strokeWidth="0.6"
      />
      <rect
        x="18.1"
        y="12.6"
        width="7.8"
        height="1.2"
        rx="0.6"
        fill={shade(skin.body, 0.45)}
        opacity="0.85"
      />

      {/* Panel lines + rivets */}
      <path
        d="M15.2 22 Q22 23.6 28.8 22"
        stroke={shade(skin.bodyDark, -0.15)}
        strokeWidth="0.6"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M15 26 Q22 27.6 29 26"
        stroke={shade(skin.bodyDark, -0.15)}
        strokeWidth="0.6"
        fill="none"
        opacity="0.35"
      />
      {[
        [17.5, 22.7],
        [22, 23.2],
        [26.5, 22.7],
      ].map(([cx, cy]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r="0.5"
          fill={shade(skin.bodyDark, -0.2)}
          opacity="0.7"
        />
      ))}

      {/* Glass window with reflection */}
      <circle
        cx="22"
        cy="18.5"
        r="3.3"
        fill={`url(#${winGrad})`}
        stroke={shade(skin.bodyDark, -0.3)}
        strokeWidth="0.7"
      />
      <path
        d="M20.1 16.8 A 2.5 2.5 0 0 1 23.5 17"
        stroke="#ffffff"
        strokeWidth="0.9"
        fill="none"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
};

type Props = {
  skin: RocketSkin;
  /** Sprite size in px; defaults to 35. Scaled with the viewport so the
   *  ship reads the same relative to the field on every screen size. */
  size?: number;
};

/**
 * The in-game rocket. The game loop writes the bank angle directly to the
 * forwarded tilt wrapper's transform (never React state), so hand-tracking
 * frames don't re-render the page; the 10ms transition keeps the banking
 * smooth.
 */
const RocketComponent = React.forwardRef<HTMLDivElement, Props>(
  function RocketComponent({ skin, size = 35 }, ref) {
    return (
      <div className="rocket-shadow">
        <div
          ref={ref}
          style={{
            transition: "all",
            animationDuration: "10ms",
          }}
        >
          <RocketSprite skin={skin} size={size} />
        </div>
      </div>
    );
  }
);

export default RocketComponent;

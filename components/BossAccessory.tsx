"use client";
import React from "react";

export type BossAccessoryKind = "orbit" | "void" | "none";

type Props = {
  kind: BossAccessoryKind;
};

/**
 * Extra decoration around the guardian's own sprite. Only the Asteroid
 * Field (orbiters) and The Void (portal rings) need them — the other
 * guardians' bodies are already distinct sprites.
 */
const BossAccessory = React.memo(function BossAccessory({ kind }: Props) {
  // Asteroid Field: small rocks orbiting the guardian.
  if (kind === "orbit") {
    return (
      <div className="boss-orbit absolute left-1/2 top-1/2">
        {[0, 120, 240].map((deg) => (
          <div
            key={deg}
            className="absolute rounded-full"
            style={{
              left: 0,
              top: 0,
              width: 14,
              height: 14,
              background: "radial-gradient(circle at 35% 35%, #d6d3d1, #78716c)",
              boxShadow: "0 0 8px rgba(248, 113, 113, 0.5)",
              transform: `rotate(${deg}deg) translateY(-120px)`,
            }}
          />
        ))}
      </div>
    );
  }

  // The Void: counter-rotating dashed rings around the eye entity.
  if (kind === "void") {
    return (
      <>
        <div
          className="boss-spin absolute rounded-full"
          style={{
            left: "50%",
            top: "50%",
            width: 260,
            height: 260,
            marginLeft: -130,
            marginTop: -130,
            border: "3px dashed rgba(167, 139, 250, 0.45)",
            boxShadow:
              "0 0 34px rgba(167, 139, 250, 0.3), inset 0 0 34px rgba(167, 139, 250, 0.2)",
          }}
        />
        <div
          className="boss-spin-reverse absolute rounded-full"
          style={{
            left: "50%",
            top: "50%",
            width: 210,
            height: 210,
            marginLeft: -105,
            marginTop: -105,
            border: "2px dotted rgba(167, 139, 250, 0.35)",
          }}
        />
      </>
    );
  }

  return null;
});

export default BossAccessory;

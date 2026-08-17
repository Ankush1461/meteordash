"use client";
import { Hand, Sparkles, Zap } from "lucide-react";
import React from "react";

type Props = {
  step: number; // 1 = tilt steering, 2 = grazing, 3 = power-ups
  onSkip: () => void;
  /** Registers the tilt-meter marker DOM node so the game loop can move it. */
  registerTiltMarker: (el: HTMLDivElement | null) => void;
};

/**
 * First-play tutorial. Hand-drawn sketchbook style callouts (wobbly card,
 * marker highlights, doodle arrow) that teach the three core skills, each
 * with a small live demo driven by the game loop. Memoized — the only
 * prop that changes during a step is `step`, so it never re-renders per
 * detection frame.
 */
const TutorialOverlay = React.memo(function TutorialOverlay({
  step,
  onSkip,
  registerTiltMarker,
}: Props) {
  const title =
    step === 1 ? "Tilt to steer" : step === 2 ? "Graze for combos" : "Grab power-ups";
  const icon =
    step === 1 ? <Hand size={22} /> : step === 2 ? <Zap size={22} /> : <Sparkles size={22} />;

  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-start justify-center pt-[4vh]">
      <div className="handdraw-card pointer-events-auto relative w-[min(92vw,430px)] px-5 py-4">
        {/* Doodle arrow pointing down at the playfield */}
        <svg
          className="absolute -bottom-9 left-1/2 -translate-x-1/2"
          width="60"
          height="44"
          viewBox="0 0 60 44"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 3 C 34 3, 54 10, 42 34"
            stroke="#334155"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="1 8"
          />
          <path
            d="M33 29 L 43 36 L 35 23"
            stroke="#334155"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="flex items-start gap-3.5">
          <div className="handdraw-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-extrabold italic leading-tight">
              {title}
            </h2>
            {/* squiggle underline */}
            <svg
              className="mt-0.5 h-2 w-40"
              viewBox="0 0 160 8"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M2 5 Q 20 1, 38 5 T 74 5 T 110 5 T 146 5 T 158 4"
                stroke="#ef4444"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        <div className="mt-3 text-[15px] font-semibold leading-relaxed">
          {step === 1 && (
            <>
              Tilt both hands like a steering wheel — the rocket follows. Hold
              a tilt to <span className="handdraw-mark">dodge</span> the
              meteors.
            </>
          )}
          {step === 2 && (
            <>
              Weave <span className="handdraw-mark">close</span> past a meteor
              without touching it — near-misses build your combo multiplier.
              Touching one costs a life!
            </>
          )}
          {step === 3 && (
            <>
              Steer into the glowing pickups —{" "}
              <span className="handdraw-mark">shield</span>, slow-mo, double
              points and extra lives. They&apos;re worth the detour!
            </>
          )}
        </div>

        {step === 1 && (
          <div className="mt-4">
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-stone-500">
              Your tilt →
            </div>
            <div className="relative mx-auto h-2 w-44 rounded-full bg-amber-900/25">
              <div
                ref={registerTiltMarker}
                className="absolute left-1/2 -top-[5px] h-4 w-4 -translate-x-1/2 rounded-full border-2 border-amber-900 bg-amber-300"
              />
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          {/* step dots */}
          <div className="flex gap-1.5" aria-label={`Step ${step} of 3`}>
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={`h-2.5 w-2.5 rounded-full ${
                  n <= step ? "bg-red-500" : "bg-stone-300"
                }`}
              />
            ))}
          </div>
          <button
            onClick={onSkip}
            className="handdraw-btn rounded-md px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-stone-700"
          >
            Skip tutorial →
          </button>
        </div>
        {/* Both hands are busy being tracked, so a click isn't always
            available — fists or a keypress skip it too. */}
        <div className="mt-2.5 text-center text-[11px] font-bold text-stone-500">
          Show both fists or press Esc to skip
        </div>
      </div>
    </div>
  );
});

export default TutorialOverlay;

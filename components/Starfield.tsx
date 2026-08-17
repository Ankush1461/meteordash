import React, {
  memo,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

type Star = {
  key: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
};

type Layer = {
  count: number;
  speed: number;
  minSize: number;
  maxSize: number;
  opacity: number;
};

// Three parallax layers: far (slow, dim, small) to near (fast, bright, big).
const LAYERS: Layer[] = [
  { count: 28, speed: 40, minSize: 1, maxSize: 2, opacity: 0.35 },
  { count: 20, speed: 90, minSize: 1.5, maxSize: 3, opacity: 0.6 },
  { count: 12, speed: 170, minSize: 2.5, maxSize: 4, opacity: 0.85 },
];

function generateStars(): Star[] {
  const stars: Star[] = [];
  let key = 0;
  for (const layer of LAYERS) {
    for (let i = 0; i < layer.count; i++) {
      stars.push({
        key: key++,
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: layer.minSize + Math.random() * (layer.maxSize - layer.minSize),
        opacity: layer.opacity,
        speed: layer.speed,
      });
    }
  }
  return stars;
}

/**
 * Decorative parallax starfield. Each layer drifts downward at its own base
 * speed multiplied by `speedRef.current` (the game loop scales this with
 * distance and zeroes it whenever the game isn't playing). Star positions
 * are mutated directly on the DOM, so nothing re-renders while moving.
 */
const Starfield = memo(function Starfield({
  speedRef,
}: {
  speedRef: MutableRefObject<number>;
}) {
  const [stars, setStars] = useState<Star[]>([]);
  const starsRef = useRef<Star[]>([]);
  const elsRef = useRef(new Map<number, HTMLDivElement>());

  useEffect(() => {
    const generated = generateStars();
    starsRef.current = generated;
    setStars(generated);

    let rafId = 0;
    let last = performance.now();
    const viewportHeight = window.innerHeight;

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const factor = speedRef.current;
      if (factor > 0) {
        for (const s of starsRef.current) {
          s.y += s.speed * factor * dt;
          if (s.y > viewportHeight + 8) {
            s.y -= viewportHeight + 16;
          }
          const el = elsRef.current.get(s.key);
          if (el) {
            el.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`;
          }
        }
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [speedRef]);

  return (
    <div
      className="absolute -inset-4 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {stars.map((s) => (
        <div
          key={s.key}
          ref={(el) => {
            if (el) {
              elsRef.current.set(s.key, el);
            } else {
              elsRef.current.delete(s.key);
            }
          }}
          className="absolute rounded-full bg-white"
          style={{
            left: 0,
            top: 0,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
            transform: `translate3d(${s.x}px, ${s.y}px, 0)`,
          }}
        />
      ))}
    </div>
  );
});

export default Starfield;

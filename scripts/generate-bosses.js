// Procedural boss sprites — realistic, no external assets.
// Usage: node scripts/generate-bosses.js  (writes public/Images/boss-*.png)
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

// ---------- PNG encoding ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- noise ----------
function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function smoothNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, seed, octaves = 5) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < octaves; i++) {
    v += amp * smoothNoise(x * f, y * f, seed + i * 97);
    amp *= 0.5;
    f *= 2;
  }
  return v;
}
// Ridged multifractal — sharp creases, ideal for cracks/filaments.
function ridge(x, y, seed, octaves = 4) {
  let v = 0, amp = 0.5, f = 1, sum = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(2 * smoothNoise(x * f, y * f, seed + i * 131) - 1);
    v += amp * n * n;
    sum += amp;
    amp *= 0.5;
    f *= 2;
  }
  return v / sum;
}
// Domain warping — bends noise coords for organic turbulent structure.
function warp(x, y, seed, amp = 1.0) {
  const qx = fbm(x, y, seed, 3) - 0.5;
  const qy = fbm(x + 5.7, y + 2.3, seed + 13, 3) - 0.5;
  return [x + qx * amp * 2, y + qy * amp * 2];
}
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function hex(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
function mix(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

// ============================================================
// ASTEROID FIELD — rough, heavily cratered rock
// ============================================================
const AST_CRATERS = (() => {
  const out = [];
  for (let i = 0; i < 14; i++) {
    const a = hash2(i * 31, 1, 9) * Math.PI * 2;
    const r = 0.12 + hash2(i * 7, 2, 9) * 0.7;
    const rad = 0.07 + hash2(i * 13, 3, 9) * 0.2;
    out.push({
      x: Math.cos(a) * r,
      y: Math.sin(a) * r,
      r: rad,
      phase: hash2(i * 3, 4, 9) * Math.PI * 2,
      px: hash2(i * 5, 5, 9) * 10,
      py: hash2(i * 11, 6, 9) * 10,
    });
  }
  return out;
})();
function astHeight(x, y) {
  let h = fbm(x * 1.6, y * 1.6, 11, 6) * 0.9;
  for (const c of AST_CRATERS) {
    const dx = x - c.x, dy = y - c.y;
    // The rim is never a perfect circle — angular wobble breaks it up.
    const ca = Math.atan2(dy, dx);
    const wob = 1 + 0.22 * Math.sin(4 * ca + c.phase) + 0.18 * (fbm(Math.cos(ca) * 3 + c.px, Math.sin(ca) * 3 + c.py, 7, 2) - 0.5);
    const cd = Math.hypot(dx, dy) / (c.r * wob);
    if (cd < 1.9) {
      // Smooth bowl with a broad, gentle raised rim.
      const bowl = Math.max(0, 1 - cd * 0.55);
      const rim = Math.exp(-Math.pow((cd - 1.1) / 0.5, 2));
      h += rim * 0.32 - bowl * 0.5;
      // High-freq roughness along the rim — no clean circle edges.
      h += rim * 0.3 * (fbm(dx * 8 + c.px, dy * 8 + c.py, 13, 2) - 0.5);
    }
  }
  return h;
}
function renderAsteroid(x, y) {
  const a = Math.atan2(y, x);
  const angN = fbm(Math.cos(a) * 4 + 3, Math.sin(a) * 4 + 1, 5, 3);
  // Fractal, irregular silhouette — no smooth circle.
  const R = 0.97 + 0.045 * Math.sin(5 * a + 2) + 0.06 * Math.sin(7 * a + 0.7) + 0.09 * (angN - 0.5);
  const r = Math.hypot(x, y);
  const d = r / R;
  if (d < 1) {
    // Height-field lighting from the upper-left.
    const e = 0.006;
    const h = astHeight(x, y);
    const hx = (astHeight(x + e, y) - astHeight(x - e, y)) / (2 * e);
    const hy = (astHeight(x, y + e) - astHeight(x, y - e)) / (2 * e);
    const nx = -hx * 1.0, ny = -hy * 1.0, nz = 1;
    const nl = Math.hypot(nx, ny, nz);
    const lx = -0.45, ly = -0.6, lz = 0.75;
    const ll = Math.hypot(lx, ly, lz);
    const diff = Math.max(0, (nx * lx + ny * ly + nz * lz) / (nl * ll));
    const ao = clamp(0.42 + h * 1.05);
    const shade = 0.16 + diff * 0.82 * ao;
    let col = mix(hex("#3a3a41"), hex("#8d8d96"), clamp(shade));
    // Micro-detail: mottled surface, not flat grey.
    const det = fbm(x * 7.5, y * 7.5, 21, 3);
    col = mix(col, hex("#a8a8b0"), clamp((det - 0.45) * 2.6) * 0.4);
    col = mix(col, hex("#232329"), clamp((0.52 - det) * 2.4) * 0.45);
    // Warm bounce light on the shadowed side.
    col = mix(col, hex("#57422e"), clamp(1 - diff) * 0.12);
    // Vignette toward the limb.
    col = mix(col, hex("#15151a"), Math.pow(d, 3) * 0.35);
    return [col[0], col[1], col[2], 255];
  }
  return [0, 0, 0, 0];
}

// ============================================================
// NEBULA STORM — a dying star: white-hot core shedding its shells
// ============================================================
function renderNebula(x, y) {
  const r = Math.hypot(x, y);
  const a = Math.atan2(y, x);
  // The dying star itself — small, blinding core with a soft bloom.
  const core = Math.exp(-Math.pow(r / 0.17, 2));
  const bloom = Math.exp(-Math.pow(r / 0.34, 2));
  // Expanding nebula envelope — irregular, clumpy.
  const R = 0.78 + 0.09 * Math.sin(3 * a + 1.2) + 0.07 * Math.sin(5 * a + 2.5) + 0.09 * fbm(Math.cos(a) * 3 + 7, Math.sin(a) * 3 + 3, 31, 3);
  const d = r / R;
  // Turbulent ionized gas.
  const [wx, wy] = warp(x * 1.25, y * 1.25, 41, 1.4);
  const gas = fbm(wx * 2.0, wy * 2.0, 51, 5);
  const fil = Math.pow(ridge(wx * 2.7, wy * 2.7, 61, 4), 1.8); // bright filaments
  // Expanding shell rings (the star's cast-off layers).
  const shell = Math.sin(r * 16 - 2 + fbm(a, 3, 71, 2) * 5);
  if (d < 1) {
    let col = mix(hex("#201a52"), hex("#4c1d95"), clamp(r * 1.9));
    col = mix(col, hex("#7c5cf0"), gas * 0.55);
    col = mix(col, hex("#5eead4"), clamp(shell) * 0.32 * clamp(1 - r * 1.1));
    col = mix(col, hex("#fb923c"), clamp(-shell) * 0.16 * clamp(1 - r * 1.5));
    col = mix(col, hex("#e9e4ff"), fil * 0.95);
    col = mix(col, hex("#ffffff"), bloom * 0.6 + core);
    const body = clamp(1 - Math.pow(d, 2.6));
    const alpha = clamp(core * 1.6 + bloom * 0.5 + gas * 0.5 + fil * 0.7) * body;
    return [col[0], col[1], col[2], Math.round(clamp(alpha) * 255)];
  }
  // Translucent outer wisps of the dying shell.
  const g = clamp(1 - (d - 1) / 0.6);
  const w = clamp(gas * 0.85) * g;
  let col = mix(hex("#8b5cf6"), hex("#1e1b4b"), gas);
  col = mix(col, hex("#5eead4"), clamp(shell) * 0.25);
  return [col[0], col[1], col[2], Math.round(w * 150)];
}

// ============================================================
// ICE FIELD — Neptune: azure gas giant with bands, storms, haze
// ============================================================
function renderNeptune(x, y) {
  const r = Math.hypot(x, y);
  const a = Math.atan2(y, x);
  // Almost perfectly round — only a whisper of wobble from atmosphere.
  const R = 0.92 + 0.012 * Math.sin(6 * a + 1) + 0.009 * Math.sin(9 * a + 3);
  const d = r / R;
  if (d < 1) {
    // Latitude bands run horizontally; irregular edges from warped noise.
    const lat = y / R;
    const [wx, wy] = warp(x * 1.6, y * 1.6, 161, 0.7);
    const bandN = fbm(wx * 1.8, wy * 1.8, 171, 4);
    const bands = Math.sin(lat * 10 + bandN * 4.5);
    let col = mix(hex("#1d3f8f"), hex("#3f6fe0"), clamp(0.5 + bands * 0.34));
    col = mix(col, hex("#5f8ef2"), clamp(0.5 - bands * 0.22) * 0.45);
    // Limb darkening — the planet's edge falls into shadow.
    col = mix(col, hex("#0c1a52"), Math.pow(d, 2.4) * 0.55);
    // The Great Dark Spot: a large dark oval storm.
    const sx = (x * 1.25 - 0.1) / 0.3, sy = (y * 0.85 + 0.04) / 0.17;
    const sd = Math.hypot(sx, sy);
    if (sd < 1) col = mix(col, hex("#0d1745"), clamp(1 - sd) * 0.85);
    // A second, smaller storm trailing it.
    const sx2 = (x * 1.25 + 0.2) / 0.14, sy2 = (y * 0.85 + 0.02) / 0.1;
    const sd2 = Math.hypot(sx2, sy2);
    if (sd2 < 1) col = mix(col, hex("#101d52"), clamp(1 - sd2) * 0.6);
    // Bright methane cirrus — wispy white streaks, mostly near the poles.
    const [px, py] = warp(x * 4.6, y * 4.6, 181, 0.5);
    const cl = fbm(px * 1.8, py * 1.8, 191, 4);
    const streak = Math.pow(clamp(1 - Math.abs(cl - 0.55) * 6.5), 2);
    col = mix(col, hex("#dbeafe"), streak * 0.6 * clamp(1 - Math.abs(lat) * 1.3));
    // Atmospheric haze hugging the limb.
    col = mix(col, hex("#9db8ff"), Math.pow(1 - d, 1.7) * 0.38);
    return [col[0], col[1], col[2], 255];
  }
  // Faint tilted rings (thin, dark — like the real planet's).
  const rr = Math.hypot(x, y / 0.42);
  let ringA = 0;
  if (Math.abs(rr - 1.06) < 0.024) ringA = clamp(1 - Math.abs(rr - 1.06) / 0.024) * 70;
  if (Math.abs(rr - 1.16) < 0.018) ringA = Math.max(ringA, clamp(1 - Math.abs(rr - 1.16) / 0.018) * 45);
  // Atmosphere rim glow beyond the limb.
  const rim = Math.exp(-Math.pow((d - 1) / 0.09, 2));
  const rimA = rim * 150;
  let col = mix(hex("#7ea2ff"), hex("#2563eb"), clamp((d - 1) / 0.09));
  if (Math.abs(rr - 1.06) < 0.024) col = mix(col, hex("#c7d8ff"), 0.6);
  return [col[0], col[1], col[2], Math.round(Math.max(ringA, rimA))];
}

// ============================================================
// LAVA BELT — a roiling sun: granulation, sunspots, corona
// ============================================================
const SUN_SPOTS = (() => {
  const out = [];
  for (let i = 0; i < 3; i++) {
    const a = hash2(i * 21, 4, 55) * Math.PI * 2;
    const r = 0.15 + hash2(i * 9, 5, 55) * 0.55;
    out.push({
      x: Math.cos(a) * r,
      y: Math.sin(a) * r,
      r: 0.08 + hash2(i * 3, 6, 55) * 0.12,
      phase: hash2(i * 7, 7, 55) * Math.PI * 2,
      px: hash2(i * 5, 8, 55) * 10,
      py: hash2(i * 11, 9, 55) * 10,
    });
  }
  return out;
})();
function renderSun(x, y) {
  const r = Math.hypot(x, y);
  const a = Math.atan2(y, x);
  // Prominences: tall arcs of plasma raised above the limb.
  let prom = 0;
  for (const pa of [0.6, 2.5, 4.1, 5.4]) {
    let da = Math.abs(a - pa);
    if (da > Math.PI) da = Math.PI * 2 - da;
    prom += Math.exp(-Math.pow(da / 0.26, 2)) * (0.09 + 0.04 * Math.sin(a * 7));
  }
  const R =
    1 + 0.026 * Math.sin(6 * a + 1) +
    0.018 * Math.sin(11 * a + 4) +
    0.05 * (fbm(Math.cos(a) * 5, Math.sin(a) * 5, 91, 3) - 0.5) +
    prom;
  const d = r / R;
  if (d < 1) {
    // Fine granulation — texture, not marbling. Low contrast on purpose.
    const [wx, wy] = warp(x * 7, y * 7, 101, 0.4);
    const g = fbm(wx * 2.2, wy * 2.2, 111, 4);
    const gran = Math.pow(clamp(1 - Math.abs(g - 0.5) * 6), 1.8);
    // Limb darkening — the disc is dimmer and redder toward the edge.
    const ld = 1 - 0.42 * Math.pow(d, 2.4);
    let col = mix(hex("#fffce6"), hex("#ffdd7a"), ld);
    col = mix(col, hex("#ffb054"), Math.pow(d, 3.2) * 0.5);
    col = mix(col, hex("#fffdf4"), gran * 0.22);
    // Faculae: brighter mottling toward the limb.
    col = mix(col, hex("#fff6cf"), gran * 0.3 * Math.pow(d, 2));
    // Sunspots: irregular dark regions with umbra + penumbra.
    for (const s of SUN_SPOTS) {
      const dx = x - s.x, dy = y - s.y;
      const ca = Math.atan2(dy, dx);
      const wob = 1 + 0.3 * Math.sin(4 * ca + s.phase) + 0.2 * (fbm(Math.cos(ca) * 3 + s.px, Math.sin(ca) * 3 + s.py, 7, 2) - 0.5);
      const wd = Math.hypot(dx, dy) / (s.r * wob);
      const umbra = clamp(1 - wd / 0.5);
      const pen = clamp(1 - Math.abs(wd - 0.72) / 0.4);
      col = mix(col, hex("#3d1c00"), Math.pow(umbra, 1.6) * 0.92);
      col = mix(col, hex("#8a3c00"), pen * 0.5);
    }
    return [col[0], col[1], col[2], 255];
  }
  // Layered corona glow, brightest right at the limb.
  const g = clamp(1 - (d - 1) / 0.5);
  let col = mix(hex("#ffcf80"), hex("#a34a00"), clamp((d - 1) / 0.5));
  // Prominences blaze above the limb.
  const promGlow = prom > 0 && d < 1.14 ? clamp(1 - (d - 1) / 0.14) * prom : 0;
  col = mix(col, hex("#ffb36b"), promGlow * 5);
  const alpha = clamp(g * 170 + promGlow * 220, 0, 255);
  return [col[0], col[1], col[2], Math.round(alpha)];
}

// ============================================================
// THE VOID — a black hole: shadow, photon ring, accretion disk
// ============================================================
const HORIZON = 0.33; // event-horizon shadow radius
const DISK_SQUASH = 0.55; // accretion disk viewed at an angle
function renderBlackHole(x, y) {
  const r = Math.hypot(x, y);
  const a = Math.atan2(y, x);
  // Event-horizon shadow: pure black.
  if (r < HORIZON * 0.985) return [0, 0, 0, 255];
  // Photon ring — the brilliant lensed ring of light hugging the shadow.
  const ringDist = Math.abs(r - HORIZON * 1.14);
  const ring = Math.exp(-Math.pow(ringDist / 0.06, 2));
  // Accretion disk in squashed (tilted) space.
  const sx = x, sy = y / DISK_SQUASH;
  const dr = Math.hypot(sx, sy);
  let col = [0, 0, 0];
  let alpha = 0;
  const diskOuter = 1.0;
  if (dr > HORIZON * 1.06 && dr < diskOuter) {
    const t = clamp((dr - HORIZON) / (diskOuter - HORIZON));
    // Relativistic beaming: the approaching side blazes, receding side dims.
    const beam = 0.45 + 0.55 * Math.cos(a + 0.5);
    // Turbulent, magnetized gas spiraling inward.
    const [wx, wy] = warp(x * 3.4, y * 3.4, 141, 0.8);
    const turb = fbm(wx * 2.0, wy * 2.0, 151, 4);
    // Temperature gradient: white-hot inner edge → orange → deep red outer.
    const temp = Math.pow(1 - t, 1.6);
    let c = mix(hex("#7a1c06"), hex("#f97316"), temp);
    c = mix(c, hex("#fde68a"), Math.pow(temp, 2) * 0.8);
    c = mix(c, hex("#fff8ef"), Math.pow(temp, 3.5));
    const bright = clamp((0.5 + turb * 0.75) * (0.45 + 0.55 * beam), 0, 1.25);
    col = [c[0] * bright, c[1] * bright, c[2] * bright];
    alpha = 255;
  }
  // Photon ring drawn over everything near the shadow.
  if (ring > 0.02) {
    const glow = mix(hex("#fff6e0"), hex("#ffc46b"), clamp((r - HORIZON) / 0.25));
    col = mix(col, glow, clamp(ring));
    alpha = Math.max(alpha, 255);
  }
  // Soft accretion halo glow beyond the disk.
  const g = Math.exp(-Math.pow((r - 0.7) / 0.5, 2));
  col = mix(col, hex("#ffc98a"), g * 0.12);
  alpha = Math.max(alpha, Math.round(g * 150));
  return [
    Math.min(255, Math.round(Math.max(0, col[0]))),
    Math.min(255, Math.round(Math.max(0, col[1]))),
    Math.min(255, Math.round(Math.max(0, col[2]))),
    alpha,
  ];
}

// ---------- render each sprite at 448x448 with 3x3 supersampling ----------
function renderSprite(painter) {
  const S = 448;
  const out = Buffer.alloc(S * S * 4);
  const c = (S - 1) / 2;
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      let r = 0, g = 0, b = 0, al = 0;
      for (let sy = 0; sy < 3; sy++) {
        for (let sx = 0; sx < 3; sx++) {
          const nx = ((px + (sx + 0.5) / 3) - c) / c;
          const ny = ((py + (sy + 0.5) / 3) - c) / c;
          const [cr, cg, cb, ca] = painter(nx, ny);
          r += cr * ca;
          g += cg * ca;
          b += cb * ca;
          al += ca;
        }
      }
      const total = al || 1;
      const i = (py * S + px) * 4;
      // Clamp: painters can overshoot 255 (hot cores, glows) and raw values
      // would wrap modulo-256 into dark banding.
      out[i] = Math.min(255, Math.round(Math.max(0, r / total)));
      out[i + 1] = Math.min(255, Math.round(Math.max(0, g / total)));
      out[i + 2] = Math.min(255, Math.round(Math.max(0, b / total)));
      out[i + 3] = Math.round(al / 9);
    }
  }
  return encodePNG(S, S, out);
}

const outDir = path.join(__dirname, "..", "public", "Images");
const specs = [
  ["boss-asteroid.png", renderAsteroid],
  ["boss-nebula.png", renderNebula],
  ["boss-neptune.png", renderNeptune],
  ["boss-lava.png", renderSun],
  ["boss-void.png", renderBlackHole],
];
for (const [name, painter] of specs) {
  const t0 = Date.now();
  fs.writeFileSync(path.join(outDir, name), renderSprite(painter));
  console.log(`wrote ${name} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
console.log("done");

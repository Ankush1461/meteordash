// Procedural social share card (1200x630) for Meteor Dash.
// Usage: node scripts/generate-og-image.js  (writes public/Images/og-meteordash.png)
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

// ---------- PNG encoding (same pipeline as the other generators) ----------
const CRC_TABLE=(()=>{const t=new Int32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c}return t})();
function crc32(buf){let c=-1;for(let i=0;i<buf.length;i++)c=CRC_TABLE[(c^buf[i])&255]^(c>>>8);return(c^-1)>>>0}
function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const tb=Buffer.from(type,"ascii");const cb=Buffer.alloc(4);cb.writeUInt32BE(crc32(Buffer.concat([tb,data])));return Buffer.concat([len,tb,data,cb])}
function encodePNG(w,h,rgba){const sig=Buffer.from([137,80,78,71,13,10,26,10]);const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;const stride=w*4;const raw=Buffer.alloc((stride+1)*h);for(let y=0;y<h;y++){raw[y*(stride+1)]=0;rgba.copy(raw,y*(stride+1)+1,y*stride,y*stride+stride)}return Buffer.concat([sig,chunk("IHDR",ihdr),chunk("IDAT",zlib.deflateSync(raw,{level:9})),chunk("IEND",Buffer.alloc(0))])}
function hash2(x,y,seed){let h=Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(seed|0,1274126177);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296}
function smoothNoise(x,y,seed){const xi=Math.floor(x),yi=Math.floor(y);const xf=x-xi,yf=y-yi;const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);const a=hash2(xi,yi,seed),b=hash2(xi+1,yi,seed),c=hash2(xi,yi+1,seed),d=hash2(xi+1,yi+1,seed);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
function fbm(x,y,seed,oct=5){let v=0,amp=0.5,f=1;for(let i=0;i<oct;i++){v+=amp*smoothNoise(x*f,y*f,seed+i*97);amp*=0.5;f*=2}return v}
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
function hex(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]}
function mix(c1,c2,t){return[lerp(c1[0],c2[0],t),lerp(c1[1],c2[1],t),lerp(c1[2],c2[2],t)]}

// ---------- The cratered rock painter (from generate-meteors.js) ----------
function makeMeteorPainter(seed) {
  const craters = [];
  for (let i = 0; i < 7; i++) {
    const a = hash2(i * 31, 1, seed) * Math.PI * 2;
    const r = 0.1 + hash2(i * 7, 2, seed) * 0.65;
    const rad = 0.08 + hash2(i * 13, 3, seed) * 0.22;
    craters.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, r: rad, phase: hash2(i * 3, 4, seed) * Math.PI * 2, px: hash2(i * 5, 5, seed) * 10, py: hash2(i * 11, 6, seed) * 10 });
  }
  function height(x, y) {
    let h = fbm(x * 1.7, y * 1.7, seed + 7, 5) * 0.9;
    for (const c of craters) {
      const dx = x - c.x, dy = y - c.y;
      const ca = Math.atan2(dy, dx);
      const wob = 1 + 0.22 * Math.sin(4 * ca + c.phase) + 0.18 * (fbm(Math.cos(ca) * 3 + c.px, Math.sin(ca) * 3 + c.py, seed + 3, 2) - 0.5);
      const cd = Math.hypot(dx, dy) / (c.r * wob);
      if (cd < 1.9) {
        const bowl = Math.max(0, 1 - cd * 0.55);
        const rim = Math.exp(-Math.pow((cd - 1.1) / 0.5, 2));
        h += rim * 0.32 - bowl * 0.5;
        h += rim * 0.3 * (fbm(dx * 8 + c.px, dy * 8 + c.py, seed + 13, 2) - 0.5);
      }
    }
    return h;
  }
  return function paint(x, y) {
    const a = Math.atan2(y, x);
    const angN = fbm(Math.cos(a) * 4 + 3, Math.sin(a) * 4 + 1, seed + 5, 3);
    const R = 0.95 + 0.05 * Math.sin(5 * a + 2) + 0.06 * Math.sin(7 * a + 0.7) + 0.09 * (angN - 0.5);
    const d = Math.hypot(x, y) / R;
    if (d < 1) {
      const e = 0.006;
      const h = height(x, y);
      const hx = (height(x + e, y) - height(x - e, y)) / (2 * e);
      const hy = (height(x, y + e) - height(x, y - e)) / (2 * e);
      const nx = -hx, ny = -hy, nz = 1;
      const nl = Math.hypot(nx, ny, nz);
      const lx = -0.45, ly = -0.6, lz = 0.75;
      const ll = Math.hypot(lx, ly, lz);
      const diff = Math.max(0, (nx * lx + ny * ly + nz * lz) / (nl * ll));
      const ao = clamp(0.42 + h * 1.05);
      const shade = 0.16 + diff * 0.82 * ao;
      let col = mix(hex("#3a3a41"), hex("#8d8d96"), clamp(shade));
      const det = fbm(x * 7.5, y * 7.5, seed + 21, 3);
      col = mix(col, hex("#a8a8b0"), clamp((det - 0.45) * 2.6) * 0.4);
      col = mix(col, hex("#232329"), clamp((0.52 - det) * 2.4) * 0.45);
      col = mix(col, hex("#57422e"), clamp(1 - diff) * 0.12);
      col = mix(col, hex("#15151a"), Math.pow(d, 3) * 0.35);
      return [col[0], col[1], col[2], 255];
    }
    return [0, 0, 0, 0];
  };
}

// ---------- 5x7 pixel font (letters used on the card) ----------
const FONT = {
  A:[0b01110,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001],
  C:[0b01111,0b10000,0b10000,0b10000,0b10000,0b10000,0b01111],
  D:[0b11110,0b10001,0b10001,0b10001,0b10001,0b10001,0b11110],
  E:[0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b11111],
  G:[0b01111,0b10000,0b10000,0b10111,0b10001,0b10001,0b01111],
  H:[0b10001,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001],
  L:[0b10000,0b10000,0b10000,0b10000,0b10000,0b10000,0b11111],
  M:[0b10001,0b11011,0b10101,0b10101,0b10001,0b10001,0b10001],
  N:[0b10001,0b11001,0b10101,0b10011,0b10001,0b10001,0b10001],
  O:[0b01110,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110],
  P:[0b11110,0b10001,0b10001,0b11110,0b10000,0b10000,0b10000],
  V:[0b10001,0b10001,0b10001,0b10001,0b10001,0b01010,0b00100],
  R:[0b11110,0b10001,0b10001,0b11110,0b10100,0b10010,0b10001],
  S:[0b01111,0b10000,0b10000,0b01110,0b00001,0b00001,0b11110],
  T:[0b11111,0b00100,0b00100,0b00100,0b00100,0b00100,0b00100],
  U:[0b10001,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110],
  " ":[0,0,0,0,0,0,0],
  "-":[0,0,0,0b11111,0,0,0],
  ".":[0,0,0,0,0,0b01100,0b01100],
};

// ---------- Scene rendering (2x supersampled, then downsampled) ----------
const W = 1200, H = 630, SS = 2;
const w = W * SS, h = H * SS;
const buf = Buffer.alloc(w * h * 4);

function setPx(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= w || y >= h || a <= 0) return;
  const i = (y * w + x) * 4;
  const na = a / 255;
  buf[i] = Math.round(buf[i] * (1 - na) + r * na);
  buf[i + 1] = Math.round(buf[i + 1] * (1 - na) + g * na);
  buf[i + 2] = Math.round(buf[i + 2] * (1 - na) + b * na);
  buf[i + 3] = 255;
}

// Background: deep-space gradient with a warm glow from the light source.
const topC = hex("#0d1526"), botC = hex("#04060c");
for (let y = 0; y < h; y++) {
  const t = y / (h - 1);
  let c = mix(topC, botC, t);
  for (let x = 0; x < w; x++) setPx(x, y, c[0], c[1], c[2], 255);
}
function radial(x, y, cx, cy, r, col, alpha) {
  const d = Math.hypot(x - cx, y - cy) / r;
  if (d >= 1) return;
  const a = alpha * Math.pow(1 - d, 2.2);
  setPx(x, y, col[0], col[1], col[2], Math.round(a * 255));
}
// Nebula tints in the zone accent colors.
const nebulas = [[480, 180, 420, hex("#a855f7"), 0.16], [140, 520, 460, hex("#38bdf8"), 0.12], [700, 600, 380, hex("#fb923c"), 0.10], [1120, 140, 300, hex("#f87171"), 0.12]];
for (let y = 0; y < h; y += 1)
  for (let x = 0; x < w; x += 1)
    for (const [cx, cy, r, col, a] of nebulas) radial(x, y, cx * SS, cy * SS, r * SS, col, a);

// Starfield.
const STARS = 340;
for (let i = 0; i < STARS; i++) {
  const sx = hash2(i * 17, 3, 999) * w;
  const sy = hash2(i * 23, 5, 999) * h;
  const br = 0.25 + hash2(i * 29, 7, 999) * 0.75;
  const warm = hash2(i * 31, 11, 999) > 0.82;
  const col = warm ? [255, 214, 160] : [208, 226, 255];
  const big = hash2(i * 37, 13, 999) > 0.9;
  const px = Math.round(sx), py = Math.round(sy);
  setPx(px, py, col[0], col[1], col[2], Math.round(br * 255));
  if (big) {
    setPx(px + 1, py, col[0], col[1], col[2], Math.round(br * 160));
    setPx(px - 1, py, col[0], col[1], col[2], Math.round(br * 160));
    setPx(px, py + 1, col[0], col[1], col[2], Math.round(br * 160));
    setPx(px, py - 1, col[0], col[1], col[2], Math.round(br * 160));
  }
}

// Text rendering (blocky pixel font with a soft glow pass).
function textWidth(str, scale) {
  return (str.length * 5 + (str.length - 1)) * scale;
}
function drawText(str, cx, topY, scale, color, glow) {
  const tw = textWidth(str, scale);
  let x0 = Math.round(cx * SS - tw * SS / 2);
  const y0 = Math.round(topY * SS);
  const s = scale * SS;
  const chars = [...str];
  const drawChar = (ch, ox, oy, col) => {
    const glyph = FONT[ch] || FONT[" "];
    for (let row = 0; row < 7; row++) {
      const bits = glyph[row];
      for (let bit = 0; bit < 5; bit++) {
        if ((bits >> (4 - bit)) & 1) {
          for (let dy = 0; dy < s; dy++)
            for (let dx = 0; dx < s; dx++)
              setPx(x0 + ox * s + bit * s + dx, y0 + oy * s + row * s + dy, col[0], col[1], col[2], 255);
        }
      }
    }
  };
  if (glow) {
    for (let ci = 0; ci < chars.length; ci++) {
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]])
        drawChar(chars[ci], ci * 6 + ox, oy, glow);
    }
  }
  for (let ci = 0; ci < chars.length; ci++) drawChar(chars[ci], ci * 6, 0, color);
}

drawText("METEOR DASH", W / 2, 118, 13, hex("#f8f4ea"), hex("#dc2626"));
drawText("HAND GESTURE ARCADE", W / 2, 268, 7, hex("#94a3b8"), null);

// The big rock, bottom-right, lit from the same upper-left source.
function drawMeteor(painter, cx, cy, R) {
  const rx = R * SS, ry = R * SS;
  const x0 = Math.floor(cx * SS - rx), x1 = Math.ceil(cx * SS + rx);
  const y0 = Math.floor(cy * SS - ry), y1 = Math.ceil(cy * SS + ry);
  for (let y = Math.max(0, y0); y < Math.min(h, y1); y++)
    for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
      const nx = (x - cx * SS) / rx, ny = (y - cy * SS) / ry;
      const [r, g, b, a] = painter(nx, ny);
      if (a > 0) setPx(x, y, r, g, b, a);
    }
}
drawMeteor(makeMeteorPainter(101), 880, 470, 170);
drawMeteor(makeMeteorPainter(202), 175, 415, 52);
drawMeteor(makeMeteorPainter(303), 1060, 95, 46);
drawMeteor(makeMeteorPainter(404), 70, 130, 34);

// ---------- Simple shape helpers ----------
function fillRect(x0, y0, x1, y1, col) {
  for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++)
      setPx(x, y, col[0], col[1], col[2], 255);
}
function fillCircle(cx, cy, r, col) {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++)
      if (Math.hypot(x - cx, y - cy) <= r) setPx(x, y, col[0], col[1], col[2], 255);
}
// Cone from an apex widening to a base: apexY <= baseY points up, else down.
function drawCone(apexX, apexY, baseX, baseY, baseHalf, col) {
  const minY = Math.min(apexY, baseY), maxY = Math.max(apexY, baseY);
  const span = maxY - minY || 1;
  for (let y = minY; y <= maxY; y++) {
    const t = (y - minY) / span;
    const half = apexY <= baseY ? baseHalf * t : baseHalf * (1 - t);
    const hx = Math.max(1, Math.round(half));
    for (let x = Math.round(apexX - hx); x <= Math.round(apexX + hx); x++)
      setPx(x, y, col[0], col[1], col[2], 255);
  }
}

// ---------- The hero: a small rocket ascending with a layered flame ----------
const HULL = hex("#e8edf5"), HULL_LIT = hex("#ffffff"), HULL_SHADE = hex("#aeb9cc");
const RED = hex("#dc2626"), RED_DARK = hex("#991b1b");
const WIN = hex("#7dd3fc"), FLAME1 = hex("#f97316"), FLAME2 = hex("#fde047"), FLAME3 = hex("#fff7ed");
function drawRocket(cx, cy, s) {
  const S = s * SS;
  const top = Math.round((cy - s * 0.5) * SS);
  const bot = Math.round((cy + s * 0.5) * SS);
  const halfW = Math.round(S * 0.38);
  const noseH = Math.round(S * 0.2);
  const bodyTop = top + noseH;
  // Engine flame: three nested cones pointing down, then a warm glow.
  const flameLen = Math.round(S * 0.46);
  const flameTip = bot + flameLen;
  for (let y = bot; y <= flameTip; y++) {
    const t = (y - bot) / (flameLen || 1);
    const flick = 1 + 0.25 * (hash2(y * 3, 41, 7) - 0.5);
    const col = t < 0.35 ? FLAME3 : t < 0.7 ? FLAME2 : FLAME1;
    const hx = Math.max(1, Math.round((1 - t) * halfW * 0.95 * flick));
    for (let x = cx - hx; x <= cx + hx; x++) setPx(x, y, col[0], col[1], col[2], 255);
  }
  fillCircle(cx, bot + Math.round(S * 0.2), Math.round(S * 0.5), [255, 130, 60, 255].slice(0, 3));
  // Body: shaded hull with a lit left edge.
  fillRect(cx - halfW, bodyTop, cx + halfW, bot, HULL);
  fillRect(cx - halfW, bodyTop, cx - halfW + Math.round(S * 0.09), bot, HULL_LIT);
  fillRect(cx + halfW - Math.round(S * 0.09), bodyTop, cx + halfW, bot, HULL_SHADE);
  // Nose cone with a red tip.
  drawCone(cx, top, cx, bodyTop, halfW, HULL);
  drawCone(cx, top, cx, bodyTop, halfW * 0.55, RED);
  // Swept fins.
  drawCone(cx + halfW, bot, cx + halfW + Math.round(S * 0.26), bot + Math.round(S * 0.16), Math.round(S * 0.1), RED_DARK);
  drawCone(cx - halfW, bot, cx - halfW - Math.round(S * 0.26), bot + Math.round(S * 0.16), Math.round(S * 0.1), RED);
  // Window.
  fillCircle(cx, bodyTop + Math.round(S * 0.28), Math.round(S * 0.11), WIN);
}

// Rocket ascending on the left; small trail sparks behind it.
drawRocket(500, 420, 185);
for (let i = 0; i < 9; i++) {
  const ty = 596 + i * 16;
  const tx = 500 + (hash2(i * 7, 91, 5) - 0.5) * 34;
  const alpha = Math.round(210 * (1 - i / 9));
  const col = i % 2 ? FLAME1 : FLAME2;
  fillCircle(Math.round(tx), ty, 4 + (i % 3) * 2, col);
  for (let dy = 0; dy < 3; dy++) setPx(Math.round(tx), ty + dy, col[0], col[1], col[2], alpha);
}

// Watermark with the game's origin.
drawText("METEORDASH.VERCEL.APP", 335, 556, 4, hex("#64748b"), null);

// Downsample 2x2 -> final card and encode.
const out = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < SS; sy++)
      for (let sx = 0; sx < SS; sx++) {
        const i = ((y * SS + sy) * w + (x * SS + sx)) * 4;
        r += buf[i]; g += buf[i + 1]; b += buf[i + 2];
      }
    const n = SS * SS, i = (y * W + x) * 4;
    out[i] = Math.round(r / n); out[i + 1] = Math.round(g / n); out[i + 2] = Math.round(b / n); out[i + 3] = 255;
  }
}
const outFile = path.join(__dirname, "..", "public", "Images", "og-meteordash.png");
const t0 = Date.now();
fs.writeFileSync(outFile, encodePNG(W, H, out));
console.log("wrote " + outFile + " in " + ((Date.now() - t0) / 1000).toFixed(1) + "s");

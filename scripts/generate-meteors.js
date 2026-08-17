// Procedural meteor sprites — the belt now matches the realistic bosses and
// projectiles. Three seed-varied cratered rock fragments rendered with the
// same height-field lighting + fractal noise used by generate-bosses.js.
// Usage: node scripts/generate-meteors.js
// Writes public/Images/meteor.png, meteor-2.png, meteor-3.png
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");
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
// Meteor painter — a rough fragment of the boss asteroid: fractal silhouette,
// craters with wobbled rims, height-field lighting, mottled surface.
function makeMeteorPainter(seed) {
  const craters = [];
  for (let i = 0; i < 7; i++) {
    const a = hash2(i * 31, 1, seed) * Math.PI * 2;
    const r = 0.1 + hash2(i * 7, 2, seed) * 0.65;
    const rad = 0.08 + hash2(i * 13, 3, seed) * 0.22;
    craters.push({
      x: Math.cos(a) * r,
      y: Math.sin(a) * r,
      r: rad,
      phase: hash2(i * 3, 4, seed) * Math.PI * 2,
      px: hash2(i * 5, 5, seed) * 10,
      py: hash2(i * 11, 6, seed) * 10,
    });
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
    const r = Math.hypot(x, y);
    const d = r / R;
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
function renderSprite(painter, S, ss) {
  const out = Buffer.alloc(S * S * 4);
  const c = (S - 1) / 2;
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      let r = 0, g = 0, b = 0, al = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const nx = ((px + (sx + 0.5) / ss) - c) / c;
          const ny = ((py + (sy + 0.5) / ss) - c) / c;
          const [cr, cg, cb, ca] = painter(nx, ny);
          r += cr * ca; g += cg * ca; b += cb * ca; al += ca;
        }
      }
      const total = al || 1;
      const i = (py * S + px) * 4;
      out[i] = Math.min(255, Math.round(Math.max(0, r / total)));
      out[i + 1] = Math.min(255, Math.round(Math.max(0, g / total)));
      out[i + 2] = Math.min(255, Math.round(Math.max(0, b / total)));
      out[i + 3] = Math.round(al / (ss * ss));
    }
  }
  return encodePNG(S, S, out);
}
const outDir = path.join(__dirname, "..", "public", "Images");
const variants = [["meteor.png", 101], ["meteor-2.png", 202], ["meteor-3.png", 303]];
for (const [name, seed] of variants) {
  const t0 = Date.now();
  fs.writeFileSync(path.join(outDir, name), renderSprite(makeMeteorPainter(seed), 256, 3));
  console.log("wrote " + name + " in " + ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
console.log("done");

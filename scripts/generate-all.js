// Regenerate every procedural asset before dev/build so a fresh clone is
// always self-sufficient (the sprites are deterministic — fixed seeds — and
// committed, but this guarantees a build never ships without them).
// Usage: node scripts/generate-all.js
"use strict";
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const scripts = [
  "generate-meteors.js",
  "generate-projectiles.js",
  "generate-bosses.js",
  "generate-og-image.js",
  "generate-upi-qr.js",
];

for (const s of scripts) {
  const t0 = Date.now();
  console.log(`[generate-all] ${s} …`);
  execFileSync(process.execPath, [path.join(__dirname, s)], { stdio: "inherit" });
  console.log(`[generate-all] ${s} done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
console.log("[generate-all] all assets regenerated");

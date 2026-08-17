// Generates the static ₹100 UPI payment QR served by the game.
//
// WHY STATIC: the QR is rendered to a PNG at build time from a hardcoded
// UPI string, so there is no runtime string building and no third-party QR
// API in the request path — nothing an attacker can swap the payee VPA with
// after the fact. The payer's UPI app still shows the payee name + amount
// and requires their UPI PIN, so scanning alone never moves money.
//
// CONFIG: set NEXT_PUBLIC_UPI_VPA (e.g. "yourname@okaxis") and optionally
// NEXT_PUBLIC_UPI_PAYEE_NAME in .env.local (or the environment). Until a
// real VPA is set, a placeholder QR is generated and a warning is printed —
// the game still renders, but the QR pays nobody, so set it before sharing.
//
// The UI reads the same env names from lib/game/support.ts, so the payee
// name shown under the QR always matches the name encoded in the QR.

const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

// --- tiny .env / .env.local loader (plain node doesn't get Next's env) ---
function loadEnvFile(file) {
  try {
    const txt = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {
    /* no env file — fine */
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const VPA = (process.env.NEXT_PUBLIC_UPI_VPA || "").trim() || "yourname@upi";
const PAYEE = (process.env.NEXT_PUBLIC_UPI_PAYEE_NAME || "").trim() || "Meteor Dash";
const NOTE = "Having fun with Meteordash";
// One static QR per preset amount — keep in sync with UPI_PRESETS in
// lib/game/support.ts. The popup only offers these presets.
const PRESETS = [50, 100, 200, 500];

const outDir = path.join(__dirname, "..", "public", "Images");

// Remove any stale support QRs from earlier runs — the old unsuffixed
// ₹100 file or presets that have since been removed — so the folder only
// holds current `upi-support-<amount>.png` files.
for (const f of fs.readdirSync(outDir)) {
  const m = /^upi-support(-(\d+))?\.png$/.exec(f);
  if (m) {
    const amt = m[2] ? Number(m[2]) : null; // null = legacy unsuffixed file
    if (amt === null || !PRESETS.includes(amt)) {
      fs.unlinkSync(path.join(outDir, f));
      console.log(`[generate-upi-qr] removed stale ${f}`);
    }
  }
}

(async () => {
  for (const AMOUNT of PRESETS) {
    const upi = `upi://pay?pa=${encodeURIComponent(
      VPA
    )}&pn=${encodeURIComponent(PAYEE)}&am=${AMOUNT}&cu=INR&tn=${encodeURIComponent(
      NOTE
    )}`;
    const outFile = path.join(outDir, `upi-support-${AMOUNT}.png`);
    await QRCode.toFile(outFile, upi, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0a0e17", light: "#ffffff" },
    });
    console.log(
      `[generate-upi-qr] wrote public/Images/upi-support-${AMOUNT}.png (₹${AMOUNT} → ${PAYEE} <${VPA}>)`
    );
  }
  if (VPA === "yourname@upi") {
    console.warn(
      "[generate-upi-qr] ⚠️  NEXT_PUBLIC_UPI_VPA is not set — the QRs are PLACEHOLDERS and pay nobody. Set it in .env.local before sharing the game."
    );
  }
})().catch((err) => {
  console.error("[generate-upi-qr] FAILED:", err.message);
  process.exit(1);
});

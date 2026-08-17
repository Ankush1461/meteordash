/**
 * UPI support-donation config — the single source of truth for the
 * "Buy me a coffee" button and QR popup.
 *
 * These env names mirror scripts/generate-upi-qr.js, which renders the
 * static QR PNGs at build time, so the payee name shown under the QR always
 * matches the name encoded in the QR. Set NEXT_PUBLIC_UPI_VPA (and
 * optionally NEXT_PUBLIC_UPI_PAYEE_NAME) in .env.local before sharing the
 * game — until then placeholder QRs are generated that pay nobody.
 */
export const UPI_VPA =
  (process.env.NEXT_PUBLIC_UPI_VPA || "").trim() || "yourname@upi";
export const UPI_PAYEE_NAME =
  (process.env.NEXT_PUBLIC_UPI_PAYEE_NAME || "").trim() || "Meteor Dash";
export const UPI_NOTE = "Having fun with Meteordash";

/** Preset tip amounts — each has its own static build-time QR PNG. */
export const UPI_PRESETS = [50, 100, 200, 500] as const;
/** Default selection. */
export const UPI_AMOUNT = 100;

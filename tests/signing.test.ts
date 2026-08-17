import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canonicalRunData,
  createRunToken,
  verifyRunSignature,
  verifyRunToken,
} from "../lib/leaderboard";

// Mirrors the non-production fallback secret in lib/leaderboard.ts
// (NODE_ENV=test under vitest, so getSecret() returns this).
const SECRET = "dev-leaderboard-secret";

const payload: Record<string, unknown> = {
  runId: "run-1",
  score: 1500,
  distance: 1000,
  zone: 3,
  maxCombo: 8,
  grazes: 40,
  powerUps: 8,
  bosses: 2,
  durationMs: 120000,
};

describe("createRunToken / verifyRunToken", () => {
  it("round-trips a freshly issued token", () => {
    const issued = createRunToken("run-1");
    expect(issued).not.toBeNull();
    expect(verifyRunToken(issued!.token)).toEqual({ runId: "run-1" });
  });

  it("issues an expiry in the future", () => {
    const issued = createRunToken("run-1");
    expect(issued!.expiresAt).toBeGreaterThan(Date.now());
  });

  it("rejects a tampered payload", () => {
    const { token } = createRunToken("run-1")!;
    const [payload64, sig] = token.split(".");
    const tampered =
      payload64.slice(0, -1) + (payload64.endsWith("A") ? "B" : "A");
    expect(verifyRunToken(`${tampered}.${sig}`)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const { token } = createRunToken("run-1")!;
    const [payload64, sig] = token.split(".");
    const badSig = sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0");
    expect(verifyRunToken(`${payload64}.${badSig}`)).toBeNull();
  });

  it("rejects an expired token", () => {
    const exp = Date.now() - 60_000;
    const iat = exp - 60_000;
    const payload64 = Buffer.from(
      JSON.stringify({ runId: "run-1", iat, exp })
    ).toString("base64url");
    const sig = createHmac("sha256", SECRET).update(payload64).digest("hex");
    expect(verifyRunToken(`${payload64}.${sig}`)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyRunToken("")).toBeNull();
    expect(verifyRunToken("no-dot-here")).toBeNull();
    expect(verifyRunToken("a.b")).toBeNull(); // not hex / not valid
  });
});

describe("canonicalRunData", () => {
  it("serializes in the fixed key order regardless of input order", () => {
    const shuffled: Record<string, unknown> = {};
    for (const k of Object.keys(payload).reverse()) shuffled[k] = payload[k];
    expect(canonicalRunData(shuffled)).toBe(canonicalRunData(payload));
  });

  it("is a stable JSON string of all nine signed fields", () => {
    expect(canonicalRunData(payload)).toBe(
      JSON.stringify(payload)
    );
  });
});

describe("verifyRunSignature", () => {
  it("accepts a correct HMAC signature keyed by the token", () => {
    const { token } = createRunToken("run-1")!;
    const sig = createHmac("sha256", token)
      .update(canonicalRunData(payload))
      .digest("hex");
    expect(verifyRunSignature(token, canonicalRunData(payload), sig)).toBe(true);
  });

  it("rejects a wrong signature", () => {
    expect(verifyRunSignature("some-token", "data", "deadbeef")).toBe(false);
    expect(
      verifyRunSignature("some-token", "data", "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef")
    ).toBe(false);
  });

  it("rejects a signature made with a different token", () => {
    const { token } = createRunToken("run-1")!;
    const sig = createHmac("sha256", "wrong-token")
      .update(canonicalRunData(payload))
      .digest("hex");
    expect(verifyRunSignature(token, canonicalRunData(payload), sig)).toBe(false);
  });
});

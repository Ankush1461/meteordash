import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as postCheck } from "../app/api/score/check/route";
import { GET as getScores, POST as postScore } from "../app/api/score/route";
import { POST as postToken } from "../app/api/score/token/route";
import { canonicalRunData, submitScore } from "../lib/leaderboard";

// The vitest config points LEADERBOARD_FILE at a dedicated test store so
// these tests never touch the real .data/leaderboard.json.
const STORE = path.join(__dirname, "..", ".data", "test-leaderboard.json");
const SECRET = "dev-leaderboard-secret"; // non-prod fallback in lib/leaderboard

function post(url: string, body: unknown): Request {
  // The Request constructor requires an absolute URL; the route handlers
  // never read it, so the origin is irrelevant.
  return new Request("http://localhost" + url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validRun(over: Record<string, unknown> = {}) {
  return {
    runId: "api-run-1",
    name: "ApiTester",
    score: 1500,
    distance: 1000,
    zone: 3,
    maxCombo: 8,
    grazes: 40,
    powerUps: 8,
    bosses: 2,
    durationMs: 120000,
    ...over,
  };
}

async function issueToken(runId: string): Promise<string> {
  const res = await postToken(post("/api/score/token", { runId }));
  expect(res.status).toBe(200);
  const json = await res.json();
  return json.token as string;
}

function sign(token: string, body: Record<string, unknown>): string {
  return createHmac("sha256", token)
    .update(canonicalRunData(body))
    .digest("hex");
}

function buildExpiredToken(runId: string): string {
  const exp = Date.now() - 60_000;
  const payload = Buffer.from(
    JSON.stringify({ runId, iat: exp - 60_000, exp })
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", SECRET).update(payload).digest("hex")}`;
}

beforeAll(() => {
  fs.rmSync(STORE, { force: true });
});

afterAll(() => {
  fs.rmSync(STORE, { force: true });
});

describe("POST /api/score/token", () => {
  it("rejects a missing or invalid runId", async () => {
    const missing = await postToken(post("/api/score/token", {}));
    expect(missing.status).toBe(400);
    const blank = await postToken(post("/api/score/token", { runId: "   " }));
    expect(blank.status).toBe(400);
    const long = await postToken(post("/api/score/token", { runId: "x".repeat(65) }));
    expect(long.status).toBe(400);
  });

  it("issues a token bound to the runId", async () => {
    const token = await issueToken("api-run-issue");
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(2);
  });
});

describe("POST /api/score", () => {
  it("rejects unsigned submissions with 401", async () => {
    const res = await postScore(post("/api/score", validRun()));
    expect(res.status).toBe(401);
    // token but no signature
    const noSig = await postScore(
      post("/api/score", { ...validRun(), token: await issueToken("api-run-u") })
    );
    expect(noSig.status).toBe(401);
  });

  it("rejects a tampered score with 401", async () => {
    const runId = "api-run-tampered";
    const token = await issueToken(runId);
    const body = validRun({ runId });
    const sig = sign(token, body);
    // Change the score AFTER signing — signature must no longer match.
    const res = await postScore(
      post("/api/score", { token, sig, ...body, score: body.score + 5000 })
    );
    expect(res.status).toBe(401);
  });

  it("rejects a cross-run token with 401", async () => {
    const tokenA = await issueToken("api-run-a");
    const body = validRun({ runId: "api-run-b" });
    const sig = sign(tokenA, body);
    const res = await postScore(post("/api/score", { token: tokenA, sig, ...body }));
    expect(res.status).toBe(401);
  });

  it("rejects an expired token with 401", async () => {
    const body = validRun({ runId: "api-run-expired" });
    const token = buildExpiredToken("api-run-expired");
    const sig = sign(token, body);
    const res = await postScore(post("/api/score", { token, sig, ...body }));
    expect(res.status).toBe(401);
  });

  it("rejects an impossible run with 400 even when properly signed", async () => {
    const runId = "api-run-impossible";
    const token = await issueToken(runId);
    // score < distance — impossible by the game's own rules.
    const body = validRun({ runId, score: 900, distance: 1000 });
    const sig = sign(token, body);
    const res = await postScore(post("/api/score", { token, sig, ...body }));
    expect(res.status).toBe(400);
  });

  it("accepts a valid signed run and returns its rank", async () => {
    const runId = "api-run-valid";
    const token = await issueToken(runId);
    const body = validRun({ runId });
    const sig = sign(token, body);
    const res = await postScore(post("/api/score", { token, sig, ...body }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.rank).toBe(1);
    expect(json.posted).toBe(true);
  });

  it("is idempotent — a duplicate runId never double-counts", async () => {
    const runId = "api-run-dup";
    const token = await issueToken(runId);
    const body = validRun({ runId });
    const sig = sign(token, body);
    const first = await postScore(post("/api/score", { token, sig, ...body }));
    expect(first.status).toBe(200);
    expect((await first.json()).posted).toBe(true);
    const second = await postScore(post("/api/score", { token, sig, ...body }));
    expect(second.status).toBe(200);
    // The duplicate runId is ignored — never double-counted.
    expect((await second.json()).rank).toBeNull();
  });
});

describe("GET /api/score", () => {
  it("returns the stored top scores", async () => {
    const res = await getScores();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.scores.length).toBeGreaterThanOrEqual(2);
    // Sorted descending by score.
    for (let i = 1; i < json.scores.length; i++) {
      expect(json.scores[i - 1].score).toBeGreaterThanOrEqual(json.scores[i].score);
    }
    const names = json.scores.map((s: { name: string }) => s.name);
    expect(names).toContain("ApiTester");
  });
});

describe("POST /api/score/check", () => {
  // Seed a full top-10 (scores 100–109) so the qualification boundary is
  // observable regardless of what the POST tests above stored.
  beforeAll(async () => {
    for (let i = 0; i < 10; i++) {
      await submitScore({
        runId: `seed-${i}`,
        name: "Seed",
        score: 100 + i,
        distance: 100,
        zone: 1,
        maxCombo: 3,
        grazes: 5,
        powerUps: 1,
        bosses: 0,
        durationMs: 15000,
        date: Date.now(),
      });
    }
  });

  it("rejects invalid scores", async () => {
    expect((await postCheck(post("/api/score/check", { score: -1 }))).status).toBe(400);
    expect((await postCheck(post("/api/score/check", { score: 1.5 }))).status).toBe(400);
    expect((await postCheck(post("/api/score/check", {}))).status).toBe(400);
  });

  it("reports whether a score cracks the top-10", async () => {
    // 10 seeded scores (100–109) are all above 1 → rank 11 → no qualify.
    const low = await postCheck(post("/api/score/check", { score: 1 }));
    expect(await low.json()).toEqual({ qualifies: false, rank: null });
    const high = await postCheck(post("/api/score/check", { score: 99999 }));
    const json = await high.json();
    expect(json.qualifies).toBe(true);
    expect(json.rank).toBe(1);
  });
});

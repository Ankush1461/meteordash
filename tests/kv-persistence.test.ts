import { createHmac } from "node:crypto";
import fs from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * End-to-end proof that the leaderboard persists through Upstash Redis.
 *
 * lib/leaderboard.ts switches to Upstash Redis the moment
 * KV_REST_API_URL + KV_REST_API_TOKEN are set (auto-synced by the Vercel
 * Marketplace integration). This suite spins up a faithful in-process mock
 * of the Upstash REST API that @upstash/redis talks to (Bearer-authenticated
 * GET /get/<key> and POST /set/<key>), backed by a JSON file on disk, then
 * runs the REAL /api/score routes against it:
 *
 *   1. token → HMAC-signed submission → stored via the Redis mock (never
 *      the file fallback — asserted).
 *   2. GET returns the run.
 *   3. Cold start: a fresh module graph (new client, same mock disk) still
 *      reads the run back — i.e. the board survives instance restarts,
 *      which is exactly what Vercel's ephemeral functions do not provide
 *      without Redis.
 */

const KV_TOKEN = "test-kv-token";

let server: Server;
let baseUrl = "";
let kvDisk = "";
let fileFallback = "";
const seen: string[] = [];

const readStore = (): Record<string, unknown> => {
  try {
    return JSON.parse(fs.readFileSync(kvDisk, "utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
};

const writeStore = (store: Record<string, unknown>) =>
  fs.writeFileSync(kvDisk, JSON.stringify(store), "utf8");

// Stores a value sent as a command argument (possibly a JSON string).
const storeValue = (store: Record<string, unknown>, key: string, raw: unknown) => {
  if (typeof raw === "string") {
    try {
      store[key] = JSON.parse(raw);
    } catch {
      store[key] = raw;
    }
  } else {
    store[key] = raw;
  }
};

function startMockKv(): Promise<number> {
  const srv = createServer((req, res) => {
    const auth = req.headers.authorization ?? "";
    seen.push(`${req.method ?? ""} ${req.url ?? ""} ${auth}`);
    if (auth !== `Bearer ${KV_TOKEN}`) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    const segments = (req.url ?? "/").split("/").filter(Boolean);
    const command = segments[0];
    const key = decodeURIComponent(segments[1] ?? "");
    const respond = (status: number, json: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(json));
    };
    if (req.method === "POST" && command === "pipeline") {
      // @upstash/redis enables auto-pipelining, so batched commands arrive
      // as [["get", key], ["set", key, value], ...] and the response is an
      // array of per-command { result, error } objects in order.
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const store = readStore();
        const commands = JSON.parse(body || "[]") as Array<Array<unknown>>;
        const results = commands.map((cmd) => {
          const name = String(cmd[0]);
          const k = decodeURIComponent(String(cmd[1] ?? ""));
          if (name === "get") return { result: store[k] ?? null };
          if (name === "set") {
            storeValue(store, k, cmd[2]);
            return { result: "OK" };
          }
          return { error: `unsupported command ${name}` };
        });
        writeStore(store);
        respond(200, results);
      });
      return;
    }
    if (command === "get") {
      respond(200, { result: readStore()[key] ?? null });
      return;
    }
    if (command === "set") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const store = readStore();
        storeValue(store, key, JSON.parse(body || "null"));
        writeStore(store);
        respond(200, { result: "OK" });
      });
      return;
    }
    respond(404, { error: "Not found" });
  });
  server = srv;
  return new Promise((resolve) =>
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      resolve(typeof address === "object" && address ? address.port : 0);
    })
  );
}

function post(url: string, body: unknown): Request {
  return new Request("http://localhost" + url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validRun(over: Record<string, unknown> = {}) {
  // Zone 4 requires distance >= 1500 (500 m per zone), and distance can't
  // exceed 10.5 m/s × duration: 1600 m / 160 s = 10 m/s — valid.
  return {
    runId: "kv-run-1",
    name: "KvTester",
    score: 2400,
    distance: 1600,
    zone: 4,
    maxCombo: 9,
    grazes: 30,
    powerUps: 5,
    bosses: 3,
    durationMs: 160000,
    ...over,
  };
}

async function issueToken(): Promise<string> {
  const { POST: postToken } = await import("../app/api/score/token/route");
  const res = await postToken(post("/api/score/token", { runId: "kv-run-1" }));
  expect(res.status).toBe(200);
  return ((await res.json()) as { token: string }).token;
}

async function sign(
  token: string,
  body: Record<string, unknown>
): Promise<string> {
  const { canonicalRunData } = await import("../lib/leaderboard");
  return createHmac("sha256", token)
    .update(canonicalRunData(body))
    .digest("hex");
}

beforeAll(async () => {
  kvDisk = path.join(os.tmpdir(), `md-kv-${Date.now()}.json`);
  fileFallback = path.join(os.tmpdir(), `md-file-${Date.now()}.json`);
  const port = await startMockKv();
  baseUrl = `http://127.0.0.1:${port}`;
  // MUST be set before the routes are imported: lib/leaderboard decides
  // store backend once, at module load.
  process.env.KV_REST_API_URL = baseUrl;
  process.env.KV_REST_API_TOKEN = KV_TOKEN;
  process.env.LEADERBOARD_SECRET = "test-secret";
  process.env.LEADERBOARD_FILE = fileFallback;
  process.env.UPSTASH_DISABLE_TELEMETRY = "1";
});

afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  for (const f of [kvDisk, fileFallback]) {
    try {
      fs.rmSync(f, { force: true });
    } catch {
      // already gone
    }
  }
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.LEADERBOARD_SECRET;
  delete process.env.LEADERBOARD_FILE;
});

describe("leaderboard persistence via Upstash Redis (mock REST)", () => {
  it("stores a signed run through the Redis path (not the file fallback)", async () => {
    vi.resetModules(); // fresh module graph → fresh @upstash/redis client
    const { POST: postScore, GET: getScores } = await import(
      "../app/api/score/route"
    );

    const token = await issueToken();
    const run = validRun();
    const sig = await sign(token, run);
    const res = await postScore(post("/api/score", { ...run, token, sig }));
    expect(res.status).toBe(200);

    const listed = await getScores();
    const json = (await listed.json()) as {
      scores: Array<{ runId: string; score: number }>;
    };
    expect(json.scores[0]).toMatchObject({ runId: "kv-run-1", score: 2400 });

    // The entry landed in the mock KV's disk, and the file fallback was
    // never touched — proving the KV backend handled the write.
    expect(fs.existsSync(kvDisk)).toBe(true);
    expect(
      JSON.parse(fs.readFileSync(kvDisk, "utf8"))["meteordash:leaderboard"]
    ).toBeDefined();
    expect(fs.existsSync(fileFallback)).toBe(false);
    // The real @upstash/redis client was used (auto-pipelined REST calls to
    // the mock) — proven by the authenticated pipeline requests it made.
    expect(seen.some((r) => r.includes("POST /pipeline"))).toBe(true);
    expect(seen.some((r) => r.includes("Bearer test-kv-token"))).toBe(true);
  });

  it("survives a cold start: a brand-new module graph reads the same board", async () => {
    // Simulates a fresh serverless instance: new module registry, new
    // @upstash/redis client, same Redis disk on the other side of the network.
    vi.resetModules();
    const { GET: getScores } = await import("../app/api/score/route");
    const res = await getScores();
    const json = (await res.json()) as {
      scores: Array<{ runId: string; score: number }>;
    };
    expect(json.scores.some((s) => s.runId === "kv-run-1")).toBe(true);
    expect(json.scores[0]?.score).toBe(2400);
  });

  it("rejects submissions when the Redis token is wrong (unauthorized)", async () => {
    // Directly prove the mock's auth gate: the real Upstash Redis behaves
    // the same way when env tokens are misconfigured.
    const token = await issueToken();
    const run = validRun();
    const sig = await sign(token, run);
    const previousToken = process.env.KV_REST_API_TOKEN;
    process.env.KV_REST_API_TOKEN = "wrong-token";
    // A fresh import picks up the wrong token (module-level client creation).
    vi.resetModules();
    const { POST: postScore } = await import("../app/api/score/route");
    const res = await postScore(post("/api/score", { ...run, token, sig }));
    expect(res.status).toBe(503); // Redis read failed → leaderboard unavailable
    process.env.KV_REST_API_TOKEN = previousToken;
  });
});

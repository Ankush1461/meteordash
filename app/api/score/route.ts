import { NextResponse } from "next/server";
import {
  canonicalRunData,
  getTopScores,
  submitScore,
  validateScore,
  verifyRunSignature,
  verifyRunToken,
} from "@/lib/leaderboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Top-10 leaderboard. */
export async function GET() {
  try {
    const scores = await getTopScores();
    return NextResponse.json({ scores });
  } catch (err) {
    console.error("leaderboard GET failed:", err);
    return NextResponse.json(
      { error: "Leaderboard unavailable" },
      { status: 503 }
    );
  }
}

/**
 * Submit a finished run. Must carry a valid per-run signing token (issued at
 * run start) and an HMAC signature over the canonical run data. Unsigned,
 * tampered, expired, or cross-run submissions are rejected before the
 * consistency validation runs. Duplicate runIds remain idempotent.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const token = typeof b.token === "string" ? b.token : "";
  const sig = typeof b.sig === "string" ? b.sig : "";
  const runId = typeof b.runId === "string" ? b.runId : "";

  // Every submission must be signed with a token issued for this exact run.
  if (!token || !sig) {
    return NextResponse.json(
      { error: "Missing signature" },
      { status: 401 }
    );
  }
  const tokenData = verifyRunToken(token);
  if (!tokenData) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }
  if (tokenData.runId !== runId) {
    return NextResponse.json(
      { error: "Token does not match run" },
      { status: 401 }
    );
  }
  if (!verifyRunSignature(token, canonicalRunData(b), sig)) {
    return NextResponse.json(
      { error: "Signature mismatch — data tampered" },
      { status: 401 }
    );
  }

  const entry = validateScore(body);
  if (!entry) {
    return NextResponse.json({ error: "Invalid score payload" }, { status: 400 });
  }

  try {
    const rank = await submitScore(entry);
    const scores = await getTopScores();
    return NextResponse.json({
      rank,
      posted: rank !== null,
      scores,
    });
  } catch (err) {
    console.error("leaderboard POST failed:", err);
    return NextResponse.json(
      { error: "Could not save score" },
      { status: 503 }
    );
  }
}

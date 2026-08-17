import { NextResponse } from "next/server";
import { checkQualification } from "@/lib/leaderboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dry-run qualification check: does this score crack the top-10 right now?
 * Nothing is persisted — the client uses this to decide whether to prompt
 * for a callsign before submitting the full run.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const score =
    typeof body === "object" && body !== null
      ? Number((body as Record<string, unknown>).score)
      : NaN;

  if (!Number.isFinite(score) || !Number.isInteger(score) || score < 0) {
    return NextResponse.json({ error: "Invalid score" }, { status: 400 });
  }

  try {
    const { qualifies, rank } = await checkQualification(score);
    return NextResponse.json({ qualifies, rank });
  } catch (err) {
    console.error("leaderboard check failed:", err);
    return NextResponse.json(
      { error: "Leaderboard unavailable" },
      { status: 503 }
    );
  }
}

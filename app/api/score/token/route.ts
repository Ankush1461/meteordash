import { NextResponse } from "next/server";
import { createRunToken } from "@/lib/leaderboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Issues a short-lived signing token for a run, called when a run starts.
 * The token is bound to the runId and expires after 60 minutes; the client
 * uses it as the HMAC key when signing the final run data.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const runId =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).runId
      : null;
  if (typeof runId !== "string" || runId.trim().length === 0 || runId.length > 64) {
    return NextResponse.json({ error: "Invalid runId" }, { status: 400 });
  }

  const issued = createRunToken(runId.trim());
  if (!issued) {
    return NextResponse.json(
      { error: "Signing disabled — set LEADERBOARD_SECRET" },
      { status: 503 }
    );
  }

  return NextResponse.json({ token: issued.token, expiresAt: issued.expiresAt });
}

// HMAC-SHA256 signature over the run payload, keyed by the run-start token.
// The payload object carries exactly the nine canonical fields in the same
// order the server serializes (canonicalRunData), so both sides produce the
// identical string. Returns a lowercase hex digest.
export async function signRunPayload(
  token: string,
  payload: Record<string, unknown>
): Promise<string> {
  const enc = new TextEncoder();
  const canonical = JSON.stringify(payload);
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(token),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(canonical));
  return [...new Uint8Array(sigBuf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

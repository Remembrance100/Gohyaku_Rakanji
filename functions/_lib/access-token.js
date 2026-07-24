// Issues the 24h HMAC-signed access token shared by every payment provider's
// verify endpoint. Format: base64( expiry | referenceId | hex(HMAC-SHA256) ).
export async function issueAccessToken(secret, referenceId) {
  const expiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  const payload = `${expiry}|${referenceId}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const token = btoa(`${payload}|${sigHex}`);

  return { token, expiry };
}

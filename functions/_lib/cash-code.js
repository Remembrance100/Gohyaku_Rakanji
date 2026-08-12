// Derives the front-desk cash code deterministically from a secret and the
// current date in JST, so it rotates once a day with no manual update and no
// storage — the same value comes out of both verify-cash-code.js (checking a
// visitor's entry) and staff-cash-code.js (showing it to the front desk).
export async function deriveCashCode(secret, dateKey) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`cash-code|${dateKey}`),
  );
  const num = new DataView(sig).getUint32(0) % 1000000;
  return String(num).padStart(6, "0");
}

// JST has no DST, so a fixed +9h offset is exact year-round. The temple's
// day — and this code — turns over at JST midnight regardless of which
// timezone Cloudflare's edge evaluates Date() in.
export function todayJstDateKey() {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

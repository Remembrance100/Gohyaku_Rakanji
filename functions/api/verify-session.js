export async function onRequestGet(context) {
  const STRIPE_SECRET = context.env.STRIPE_SECRET_KEY;
  const url = new URL(context.request.url);
  const sessionId = url.searchParams.get("session_id");

  if (!sessionId || !STRIPE_SECRET) {
    return Response.json({ valid: false }, { status: 400 });
  }

  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
  });

  const session = await res.json();

  if (!res.ok || session.payment_status !== "paid") {
    return Response.json({ valid: false });
  }

  // Issue a signed token: base64( expiry | sessionId ) + HMAC
  const expiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  const payload = `${expiry}|${sessionId}`;
  const secret = context.env.TOKEN_SECRET || STRIPE_SECRET;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const sigHex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const token = btoa(`${payload}|${sigHex}`);

  return Response.json({ valid: true, token, expiry });
}

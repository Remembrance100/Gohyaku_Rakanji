import { issueAccessToken } from "../_lib/access-token.js";

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

  const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
  if (!res.ok || !paid) {
    return Response.json({ valid: false });
  }

  const secret = context.env.TOKEN_SECRET || STRIPE_SECRET;
  const { token, expiry } = await issueAccessToken(secret, sessionId);

  return Response.json({ valid: true, token, expiry });
}

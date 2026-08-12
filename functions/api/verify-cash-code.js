import { deriveCashCode, todayJstDateKey } from "../_lib/cash-code.js";
import { issueAccessToken } from "../_lib/access-token.js";

// Same fallback chain as verify-session.js/verify-paypay-payment.js: a
// dedicated secret if one's been set, otherwise the Stripe key everything
// else already falls back to.
function cashSecret(env) {
  return env.CASH_CODE_SECRET || env.TOKEN_SECRET || env.STRIPE_SECRET_KEY;
}

export async function onRequestPost(context) {
  const secret = cashSecret(context.env);
  if (!secret) {
    return Response.json({ valid: false }, { status: 500 });
  }

  let body = {};
  try {
    body = await context.request.json();
  } catch {}

  const submitted = String(body.code || "").trim();
  if (!/^\d{6}$/.test(submitted)) {
    return Response.json({ valid: false });
  }

  const dateKey = todayJstDateKey();
  const expected = await deriveCashCode(secret, dateKey);

  if (submitted !== expected) {
    return Response.json({ valid: false });
  }

  const { token, expiry } = await issueAccessToken(secret, `cash:${dateKey}`);
  return Response.json({ valid: true, token, expiry });
}

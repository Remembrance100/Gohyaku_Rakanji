import { callPayPayRelay } from "../_lib/paypay-relay.js";
import { issueAccessToken } from "../_lib/access-token.js";

// Status comes from the WordPress relay (see functions/_lib/paypay-relay.js for
// why), but the access token is still minted here — TOKEN_SECRET stays on
// Cloudflare and the relay never sees it, so a compromised relay cannot hand
// out tour access on its own.
export async function onRequestGet(context) {
  // Same fallback as verify-session.js: TOKEN_SECRET was never set on this
  // project, so both providers sign with STRIPE_SECRET_KEY. They have to agree
  // — a token minted under one key would not match one minted under the other.
  const TOKEN_SECRET = context.env.TOKEN_SECRET || context.env.STRIPE_SECRET_KEY;
  const url = new URL(context.request.url);
  const merchantPaymentId = url.searchParams.get("merchantPaymentId");

  if (!merchantPaymentId || !TOKEN_SECRET) {
    return Response.json({ valid: false }, { status: 400 });
  }

  const { ok, data } = await callPayPayRelay(context.env, "status", {
    method: "GET",
    query: { merchantPaymentId },
  });

  if (!ok || data?.status !== "COMPLETED") {
    return Response.json({ valid: false });
  }

  const { token, expiry } = await issueAccessToken(TOKEN_SECRET, merchantPaymentId);

  return Response.json({ valid: true, token, expiry });
}

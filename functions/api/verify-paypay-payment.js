import { callPayPayRelay } from "../_lib/paypay-relay.js";
import { issueAccessToken } from "../_lib/access-token.js";

// Status comes from the WordPress relay (see functions/_lib/paypay-relay.js for
// why), but the access token is still minted here — TOKEN_SECRET stays on
// Cloudflare and the relay never sees it, so a compromised relay cannot hand
// out tour access on its own.
export async function onRequestGet(context) {
  const TOKEN_SECRET = context.env.TOKEN_SECRET;
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

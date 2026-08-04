import { callPayPayRelay } from "../_lib/paypay-relay.js";

// PayPay is called via the WordPress relay rather than directly: this account's
// API access is restricted to whitelisted IPs, and Pages Functions have no
// fixed egress IP. See functions/_lib/paypay-relay.js for the full background.
//
// The amount and order description live on the relay, not here, so this
// endpoint cannot be used to create a payment at a price of its own choosing.
export async function onRequestPost(context) {
  const origin = new URL(context.request.url).origin;

  const { ok, data } = await callPayPayRelay(context.env, "create", {
    method: "POST",
    body: { redirectUrl: `${origin}/tour.html` },
  });

  if (!ok || !data?.url) {
    const message = data?.error || "PayPay error";
    return Response.json(
      { error: data?.code ? `${message} (${data.code})` : message },
      { status: 502 },
    );
  }

  return Response.json({ url: data.url });
}

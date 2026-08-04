import { callPayPayRelay } from "../_lib/paypay-relay.js";

// PayPay is called via the WordPress relay rather than directly: this account's
// API access is restricted to whitelisted IPs, and Pages Functions have no
// fixed egress IP. See functions/_lib/paypay-relay.js for the full background.
//
// The amount and order description live on the relay, not here, so this
// endpoint cannot be used to create a payment at a price of its own choosing.
//
// Failures answer 422, never 5xx: Cloudflare replaces a 5xx from a Pages
// Function with its own "error code: 502" page, which discards the JSON body
// and leaves the caller — and anyone debugging — with no reason for the
// failure. 422 passes through untouched.
export async function onRequestPost(context) {
  try {
    const origin = new URL(context.request.url).origin;

    const { ok, data } = await callPayPayRelay(context.env, "create", {
      method: "POST",
      body: { redirectUrl: `${origin}/tour.html` },
    });

    if (!ok || !data?.url) {
      const message = data?.error || "PayPay error";
      return Response.json(
        { error: data?.code ? `${message} (${data.code})` : message },
        { status: 422 },
      );
    }

    return Response.json({ url: data.url });
  } catch (err) {
    return Response.json(
      { error: `Relay call failed: ${err?.message || String(err)}` },
      { status: 422 },
    );
  }
}

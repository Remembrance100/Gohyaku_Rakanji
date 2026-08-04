import { callPayPayRelay } from "../_lib/paypay-relay.js";

// PayPay is called via the WordPress relay rather than directly: this account's
// API access is restricted to whitelisted IPs, and Pages Functions have no
// fixed egress IP. See functions/_lib/paypay-relay.js for the full background.
//
// The amount and order description live on the relay, not here, so this
// endpoint cannot be used to create a payment at a price of its own choosing.
export async function onRequestPost(context) {
  try {
    const origin = new URL(context.request.url).origin;

    // TEMPORARY diagnostic. `?debug=1` reports which stage the request reaches
    // and whether config is present, without contacting PayPay. Reports only
    // presence and lengths — never a credential value. Remove once the relay
    // is confirmed working end to end.
    if (new URL(context.request.url).searchParams.get("debug") === "1") {
      const relayUrl = context.env.PAYPAY_RELAY_URL || "";
      const relaySecret = context.env.PAYPAY_RELAY_SECRET || "";
      let probe = null;
      try {
        const r = await fetch("https://rakanji.org/?rest_route=/memorial/v1/paypay/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        probe = { reached: true, status: r.status };
      } catch (e) {
        probe = { reached: false, error: e?.message || String(e) };
      }
      return Response.json({
        handlerRan: true,
        origin,
        relayUrlSet: Boolean(relayUrl),
        relayUrlHost: relayUrl ? new URL(relayUrl).host : null,
        relayUrlLength: relayUrl.length,
        relaySecretSet: Boolean(relaySecret),
        relaySecretLength: relaySecret.length,
        directFetchProbe: probe,
      });
    }

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
  } catch (err) {
    // An unhandled throw here surfaces as Cloudflare's bare "error code: 502"
    // with no detail, which is undiagnosable from outside. Report the message
    // instead — it never contains credentials, only the failure reason.
    return Response.json(
      { error: `Relay call failed: ${err?.message || String(err)}` },
      { status: 502 },
    );
  }
}

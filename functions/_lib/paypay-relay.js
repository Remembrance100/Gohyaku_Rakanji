// Calls the PayPay relay that runs on WordPress (wordpress/paypay-relay.php).
//
// PayPay restricts API access to IPs registered during merchant application,
// and Pages Functions have no fixed egress IP — requests leave from rotating
// Cloudflare addresses, so PayPay rejected every one with `Unauthorized
// request (08100016)` regardless of how correct the signature was. The
// WordPress host's outbound address is already on PayPay's allow list, so the
// PayPay call is made there and this module just talks to it.
//
// The relay holds the PayPay credentials; Cloudflare only needs the shared
// RELAY secret. Requests are signed so the relay isn't an open endpoint anyone
// can use to mint payment codes against the merchant account.

function base64(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function signRelayRequest(secret, timestamp, body) {
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
    new TextEncoder().encode(`${timestamp}\n${body}`),
  );
  return base64(new Uint8Array(sig));
}

/**
 * @param {object} env      Pages env — needs PAYPAY_RELAY_URL and PAYPAY_RELAY_SECRET.
 * @param {string} route    "create" or "status".
 * @param {object} options  { method, body, query }
 */
export async function callPayPayRelay(env, route, { method = "POST", body = null, query = {} } = {}) {
  const relayUrl = env.PAYPAY_RELAY_URL;
  const relaySecret = env.PAYPAY_RELAY_SECRET;

  if (!relayUrl || !relaySecret) {
    return { ok: false, status: 500, data: { error: "Relay not configured" } };
  }

  // The WordPress host serves REST via the ?rest_route= form, so the route and
  // any query string have to be folded into that parameter rather than the path.
  // A malformed PAYPAY_RELAY_URL throws here, which would otherwise become an
  // opaque 502 at the edge — report it as a configuration problem instead.
  let url;
  try {
    url = new URL(relayUrl);
    const existing = url.searchParams.get("rest_route") || "";
    url.searchParams.set("rest_route", `${existing}/${route}`.replace(/\/{2,}/g, "/"));
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  } catch {
    return { ok: false, status: 500, data: { error: "PAYPAY_RELAY_URL is not a valid URL" } };
  }

  const payload = body === null ? "" : JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await signRelayRequest(relaySecret, timestamp, payload);

  const headers = {
    "X-Relay-Timestamp": timestamp,
    "X-Relay-Signature": signature,
  };
  if (body !== null) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: body === null ? undefined : payload,
    });
  } catch (err) {
    return { ok: false, status: 502, data: { error: "Relay unreachable" } };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    // A WordPress fatal or an HTML error page rather than the JSON we expect.
    return { ok: false, status: 502, data: { error: "Relay returned a non-JSON response" } };
  }

  return { ok: res.ok, status: res.status, data };
}

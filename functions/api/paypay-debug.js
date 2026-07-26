// TEMPORARY diagnostic — reports PayPay env configuration WITHOUT exposing
// secret values (only presence, length, and whitespace problems). Gated behind
// ?k=rakancheck so it isn't publicly enumerable. DELETE THIS FILE once the
// PayPay connection is confirmed working.
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  if (url.searchParams.get("k") !== "rakancheck") {
    return new Response("Not found", { status: 404 });
  }

  const env = context.env;
  const raw = (v) => (typeof v === "string" ? v : "");
  const inspect = (name) => {
    const v = raw(env[name]);
    return {
      present: Boolean(v),
      length: v.length,
      trimmedLength: v.trim().length,
      hasWhitespaceEdges: v.length !== v.trim().length,
    };
  };

  const isStaging = env.PAYPAY_ENV === "STAGING";
  return Response.json({
    resolvedEndpoint: isStaging
      ? "STAGING → https://apigw.stg.paypay.ne.jp"
      : "PROD → https://apigw.paypay.ne.jp",
    PAYPAY_ENV: raw(env.PAYPAY_ENV) || "(unset → PROD)",
    // Expected from the production email: key len 17, secret len ~44 (ends in =),
    // merchant id len 18.
    PAYPAY_API_KEY: inspect("PAYPAY_API_KEY"),
    PAYPAY_API_SECRET: inspect("PAYPAY_API_SECRET"),
    PAYPAY_MERCHANT_ID: inspect("PAYPAY_MERCHANT_ID"),
  });
}

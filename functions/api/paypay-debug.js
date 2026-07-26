// TEMPORARY diagnostic — DELETE once PayPay is confirmed working.
// ?k=rakancheck            → reports env config (no secret values, only lengths).
// ?k=rakancheck&call=1     → makes the REAL /v2/codes call with the stored env
//                            vars and returns PayPay's full response, tried both
//                            WITH and WITHOUT the X-ASSUME-MERCHANT header.
import { buildPayPayAuthHeader } from "../_lib/paypay-auth.js";

const BASE_URLS = {
  PROD: "https://apigw.paypay.ne.jp",
  STAGING: "https://apigw.stg.paypay.ne.jp",
};

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
  const baseUrl = isStaging ? BASE_URLS.STAGING : BASE_URLS.PROD;

  const report = {
    resolvedEndpoint: isStaging ? `STAGING → ${BASE_URLS.STAGING}` : `PROD → ${BASE_URLS.PROD}`,
    PAYPAY_ENV: raw(env.PAYPAY_ENV) || "(unset → PROD)",
    PAYPAY_API_KEY: inspect("PAYPAY_API_KEY"),
    PAYPAY_API_SECRET: inspect("PAYPAY_API_SECRET"),
    PAYPAY_MERCHANT_ID: inspect("PAYPAY_MERCHANT_ID"),
  };

  if (url.searchParams.get("call") !== "1") {
    return Response.json(report);
  }

  const API_KEY = raw(env.PAYPAY_API_KEY);
  const API_SECRET = raw(env.PAYPAY_API_SECRET);
  const MERCHANT_ID = raw(env.PAYPAY_MERCHANT_ID);
  const origin = url.origin;
  const path = "/v2/codes";

  async function attempt(includeAssumeMerchant) {
    const merchantPaymentId = crypto.randomUUID();
    const body = JSON.stringify({
      merchantPaymentId,
      amount: { amount: 1000, currency: "JPY" },
      codeType: "ORDER_QR",
      orderDescription: "Memorial Tour Guide — 24-hour access",
      redirectUrl: `${origin}/tour.html?paypay_payment_id=${merchantPaymentId}`,
      redirectType: "WEB_LINK",
    });
    const { header, contentType } = await buildPayPayAuthHeader({
      apiKey: API_KEY,
      apiSecret: API_SECRET,
      method: "POST",
      path,
      body,
    });
    const headers = { "Content-Type": contentType, Authorization: header };
    if (includeAssumeMerchant) headers["X-ASSUME-MERCHANT"] = MERCHANT_ID;

    try {
      const res = await fetch(`${baseUrl}${path}`, { method: "POST", headers, body });
      const text = await res.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch {}
      return { httpStatus: res.status, response: parsed ?? text };
    } catch (e) {
      return { error: `fetch threw: ${e?.message || String(e)}` };
    }
  }

  return Response.json({
    config: report,
    call: {
      withAssumeMerchant: await attempt(true),
      withoutAssumeMerchant: await attempt(false),
    },
  });
}

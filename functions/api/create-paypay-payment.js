import { buildPayPayAuthHeader } from "../_lib/paypay-auth.js";

const BASE_URLS = {
  PROD: "https://apigw.paypay.ne.jp",
  STAGING: "https://apigw.stg.paypay.ne.jp",
};

export async function onRequestPost(context) {
  const API_KEY = context.env.PAYPAY_API_KEY;
  const API_SECRET = context.env.PAYPAY_API_SECRET;
  const MERCHANT_ID = context.env.PAYPAY_MERCHANT_ID;
  const baseUrl = BASE_URLS[context.env.PAYPAY_ENV === "STAGING" ? "STAGING" : "PROD"];
  const origin = new URL(context.request.url).origin;

  if (!API_KEY || !API_SECRET || !MERCHANT_ID) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const merchantPaymentId = crypto.randomUUID();
  const path = "/v2/codes";

  const payload = {
    merchantPaymentId,
    amount: { amount: 1000, currency: "JPY" },
    codeType: "ORDER_QR",
    orderDescription: "Memorial Tour Guide — 24-hour access",
    redirectUrl: `${origin}/tour.html?paypay_payment_id=${merchantPaymentId}`,
    redirectType: "WEB_LINK",
  };
  const body = JSON.stringify(payload);

  const { header, contentType } = await buildPayPayAuthHeader({
    apiKey: API_KEY,
    apiSecret: API_SECRET,
    method: "POST",
    path,
    body,
  });

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      Authorization: header,
      "X-ASSUME-MERCHANT": MERCHANT_ID,
    },
    body,
  });

  const data = await res.json();

  if (!res.ok || !data?.data?.url) {
    return Response.json({ error: data?.resultInfo?.message || "PayPay error" }, { status: 502 });
  }

  return Response.json({ url: data.data.url });
}

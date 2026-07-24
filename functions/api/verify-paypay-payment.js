import { buildPayPayAuthHeader } from "../_lib/paypay-auth.js";
import { issueAccessToken } from "../_lib/access-token.js";

const BASE_URLS = {
  PROD: "https://apigw.paypay.ne.jp",
  STAGING: "https://apigw.stg.paypay.ne.jp",
};

export async function onRequestGet(context) {
  const API_KEY = context.env.PAYPAY_API_KEY;
  const API_SECRET = context.env.PAYPAY_API_SECRET;
  const MERCHANT_ID = context.env.PAYPAY_MERCHANT_ID;
  const TOKEN_SECRET = context.env.TOKEN_SECRET;
  const baseUrl = BASE_URLS[context.env.PAYPAY_ENV === "STAGING" ? "STAGING" : "PROD"];

  const url = new URL(context.request.url);
  const merchantPaymentId = url.searchParams.get("merchantPaymentId");

  if (!merchantPaymentId || !API_KEY || !API_SECRET || !MERCHANT_ID || !TOKEN_SECRET) {
    return Response.json({ valid: false }, { status: 400 });
  }

  const path = `/v2/codes/payments/${merchantPaymentId}`;

  const { header } = await buildPayPayAuthHeader({
    apiKey: API_KEY,
    apiSecret: API_SECRET,
    method: "GET",
    path,
    body: "",
  });

  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: header,
      "X-ASSUME-MERCHANT": MERCHANT_ID,
    },
  });

  const result = await res.json();

  if (!res.ok || result?.data?.status !== "COMPLETED") {
    return Response.json({ valid: false });
  }

  const { token, expiry } = await issueAccessToken(TOKEN_SECRET, merchantPaymentId);

  return Response.json({ valid: true, token, expiry });
}

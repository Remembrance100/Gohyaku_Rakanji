import { md5Bytes, bytesToBase64 } from "./crypto-md5.js";

function randomNonce(length = 8) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function hmacSha256Base64(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return bytesToBase64(new Uint8Array(sig));
}

// Builds the `Authorization` header PayPay's Online Payment API (OPA)
// requires: a custom HMAC-SHA256 scheme signing
// {path, method, nonce, epoch, contentType, bodyHash}\n-joined. PayPay
// documents the request-body hash as MD5(contentType + body), base64
// encoded — Workers' native Web Crypto has no MD5, hence crypto-md5.js.
// Spec: https://www.paypay.ne.jp/opa/doc/jp/v1.0/hmac_authentication
export async function buildPayPayAuthHeader({ apiKey, apiSecret, method, path, body }) {
  const nonce = randomNonce(8);
  const epoch = Math.floor(Date.now() / 1000);
  const contentType = "application/json;charset=UTF-8";

  let hash = "empty";
  let dataContentType = "empty";
  if (method !== "GET") {
    hash = bytesToBase64(md5Bytes(contentType + body));
    dataContentType = contentType;
  }

  const dataToSign = [path, method, nonce, epoch, dataContentType, hash].join("\n");
  const signature = await hmacSha256Base64(apiSecret, dataToSign);

  return {
    header: `hmac OPA-Auth:${apiKey}:${signature}:${nonce}:${epoch}:${hash}`,
    contentType,
  };
}

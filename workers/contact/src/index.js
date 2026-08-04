// Contact form relay for tour.rakanji.org.
//
// Runs as a standalone Worker rather than a Pages Function because the free
// Email Routing `send_email` binding is only available to Workers — the paid
// Email Sending REST API is the only option from inside Pages. A route on
// tour.rakanji.org/api/contact (see wrangler.toml) puts it on the same origin
// as the site, so contact.html can POST to /api/contact with no CORS involved.
//
// Requires, in the Cloudflare dashboard under Email Routing for rakanji.org:
//   - CONTACT_FROM as a custom address on the zone
//   - CONTACT_TO added and confirmed as a verified destination address
// The binding is locked to CONTACT_TO in wrangler.toml, so this Worker cannot
// be coerced into mailing anyone else.

import { EmailMessage } from "cloudflare:email";

const MAX_LENGTHS = { name: 120, email: 200, category: 40, message: 5000 };

const CATEGORY_LABELS = {
  payment: "お支払い・購入について",
  technical: "音声ガイドの不具合について",
  general: "一般的なご質問",
  other: "その他",
};

const ALLOWED_ORIGINS = ["https://tour.rakanji.org"];
const FROM_NAME = "羅漢寺音声ガイド";

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// Keep submitted values out of the header block so a crafted name/email can't
// inject extra headers into the outgoing mail.
function stripNewlines(value) {
  return value.replace(/[\r\n]+/g, " ");
}

// Full-width kana/kanji render at roughly 2x the width of ASCII in any font a
// mail client would plausibly use — treat them as such so the label columns
// in the body actually line up.
function visualWidth(str) {
  let width = 0;
  for (const ch of str) {
    const code = ch.codePointAt(0);
    const isWide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6);
    width += isWide ? 2 : 1;
  }
  return width;
}

function padLabel(label, targetWidth) {
  return label + " ".repeat(Math.max(targetWidth - visualWidth(label), 1));
}

function formatJstTimestamp(date) {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "narrow",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}年${get("month")}月${get("day")}日(${get("weekday")}) ${get("hour")}:${get("minute")}`;
}

function base64(input) {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// RFC 2047 encoded-word, so Japanese subjects survive the header. Each word has
// to stay under 75 chars including the =?UTF-8?B? wrapper, and a multi-byte
// character must never be split across two of them.
function encodeHeaderValue(value) {
  if (/^[\x20-\x7E]*$/.test(value)) return value;

  const encoder = new TextEncoder();
  const chunks = [];
  let chunk = "";

  for (const char of value) {
    if (encoder.encode(chunk + char).length > 45) {
      chunks.push(chunk);
      chunk = char;
    } else {
      chunk += char;
    }
  }
  if (chunk) chunks.push(chunk);

  return chunks.map((part) => `=?UTF-8?B?${base64(part)}?=`).join("\r\n ");
}

function buildMimeMessage({ fromName, fromAddr, toAddr, replyTo, subject, text }) {
  const headers = [
    `From: ${fromName} <${fromAddr}>`,
    `To: ${toAddr}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${encodeHeaderValue(subject)}`,
    `Message-ID: <${crypto.randomUUID()}@rakanji.org>`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];

  const body = base64(text).match(/.{1,76}/g)?.join("\r\n") ?? "";
  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed =
    ALLOWED_ORIGINS.includes(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  if (!allowed) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(payload, status, cors) {
  return Response.json(payload, { status, headers: cors });
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ ok: false, error: "method_not_allowed" }, 405, cors);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ ok: false, error: "bad_request" }, 400, cors);
    }

    const name = clean(payload?.name, MAX_LENGTHS.name);
    const email = clean(payload?.email, MAX_LENGTHS.email);
    const category = clean(payload?.category, MAX_LENGTHS.category);
    const message = clean(payload?.message, MAX_LENGTHS.message);
    const lang = clean(payload?.lang, 5) || "ja";

    if (!name || !email || !message || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ ok: false, error: "invalid" }, 400, cors);
    }

    const categoryLabel = CATEGORY_LABELS[category] || category || "その他";

    const raw = buildMimeMessage({
      fromName: FROM_NAME,
      fromAddr: env.CONTACT_FROM,
      toAddr: env.CONTACT_TO,
      replyTo: stripNewlines(email),
      subject: stripNewlines(`【音声ガイド】${categoryLabel} — ${name}`),
      text: [
        "【お問い合わせ詳細】",
        "-".repeat(40),
        `${padLabel("日時:", 10)}${formatJstTimestamp(new Date())}`,
        `${padLabel("送信元:", 10)}${FROM_NAME} ${env.CONTACT_FROM}`,
        "",
        "お客様情報:",
        `・${padLabel("お名前:", 14)}${name}`,
        `・${padLabel("メール:", 14)}${email}`,
        `・${padLabel("カテゴリー:", 14)}${categoryLabel}`,
        `・${padLabel("言語設定:", 14)}${lang}`,
        "",
        "お問い合わせ内容:",
        message,
      ].join("\n"),
    });

    try {
      await env.EMAIL.send(
        new EmailMessage(env.CONTACT_FROM, env.CONTACT_TO, raw),
      );
    } catch (err) {
      // Most likely causes: CONTACT_FROM isn't a custom address on the zone, or
      // CONTACT_TO hasn't had its verification link clicked yet.
      console.error("send_email failed", err?.message);
      return json({ ok: false, error: "send_failed" }, 502, cors);
    }

    return json({ ok: true }, 200, cors);
  },
};

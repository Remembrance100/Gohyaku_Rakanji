// MIME helpers for the Workers that send mail through the Email Routing
// send_email binding.
//
// Lifted from workers/contact/src/index.js, which still carries its own copy —
// it is deployed and working, so it was left alone rather than refactored
// underneath itself. Worth collapsing the two the next time that Worker is
// touched for another reason.
//
// The reason any of this exists: send_email takes a raw RFC 5322 message, and
// Japanese subject lines are not ASCII, so they have to go out as RFC 2047
// encoded-words or mail servers mangle them.

export function base64(input) {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// RFC 2047 encoded-word, so Japanese header values survive as e.g.
// "Subject: =?UTF-8?B?...?=". A multi-byte character must never be split
// across two encoded words, and every physical line (continuation lines get
// a single leading space, the first line gets "<fieldName>: ") must stay at
// or under 76 chars, or some mail servers will mangle the fold.
export function encodeHeaderValue(fieldName, value) {
  if (/^[\x20-\x7E]*$/.test(value)) return `${fieldName}: ${value}`;

  const encoder = new TextEncoder();
  const chunks = [];
  let chunk = "";

  for (const char of value) {
    const prefixLen = chunks.length === 0 ? fieldName.length + 2 : 1;
    const candidateBytes = encoder.encode(chunk + char).length;
    const encodedWordLen = 10 + Math.ceil(candidateBytes / 3) * 4 + 2; // =?UTF-8?B? + base64 + ?=

    if (prefixLen + encodedWordLen > 76) {
      chunks.push(chunk);
      chunk = char;
    } else {
      chunk += char;
    }
  }
  if (chunk) chunks.push(chunk);

  const words = chunks.map((part) => `=?UTF-8?B?${base64(part)}?=`);
  return `${fieldName}: ${words[0]}${words.slice(1).map((w) => `\r\n ${w}`).join("")}`;
}

// Keep submitted or interpolated values out of the header block so nothing can
// inject extra headers into the outgoing mail.
export function stripNewlines(value) {
  return String(value).replace(/[\r\n]+/g, " ");
}

export function buildMimeMessage({ fromName, fromAddr, toAddr, replyTo, subject, text }) {
  const headers = [
    `From: ${fromName} <${fromAddr}>`,
    `To: ${toAddr}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    encodeHeaderValue("Subject", stripNewlines(subject)),
    `Message-ID: <${crypto.randomUUID()}@rakanji.org>`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];

  const body = base64(text).match(/.{1,76}/g)?.join("\r\n") ?? "";
  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

// JST has no DST, so a fixed +9h offset is exact year-round.
export function jstDateParts(date) {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "narrow",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    long: `${get("year")}年${get("month")}月${get("day")}日(${get("weekday")})`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

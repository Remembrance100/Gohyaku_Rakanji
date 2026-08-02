// Receives the contact form from contact.html and relays it to the temple
// office via Resend. Requires RESEND_API_KEY and (optionally) CONTACT_FROM /
// CONTACT_TO to be set as Cloudflare Pages environment variables.

const DEFAULT_TO = "500@rakan.or.jp";
const DEFAULT_FROM = "Rakanji Audio Guide <guide@rakan.or.jp>";
const MAX_LENGTHS = { name: 120, email: 200, category: 40, message: 5000 };

const CATEGORY_LABELS = {
  payment: "お支払い・購入について",
  technical: "音声ガイドの不具合について",
  general: "一般的なご質問",
  other: "その他",
};

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// Keep submitted values out of the header block so a crafted name/email can't
// inject extra headers into the outgoing mail.
function stripNewlines(value) {
  return value.replace(/[\r\n]+/g, " ");
}

export async function onRequestPost(context) {
  const apiKey = context.env.RESEND_API_KEY;
  if (!apiKey) {
    return Response.json(
      { ok: false, error: "not_configured" },
      { status: 500 },
    );
  }

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return Response.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const name = clean(payload?.name, MAX_LENGTHS.name);
  const email = clean(payload?.email, MAX_LENGTHS.email);
  const category = clean(payload?.category, MAX_LENGTHS.category);
  const message = clean(payload?.message, MAX_LENGTHS.message);
  const lang = clean(payload?.lang, 5) || "ja";

  if (!name || !email || !message || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const categoryLabel = CATEGORY_LABELS[category] || category || "その他";
  const subject = stripNewlines(
    `【音声ガイド】${categoryLabel} — ${name}`,
  );

  const body = [
    `お名前: ${name}`,
    `メールアドレス: ${email}`,
    `カテゴリー: ${categoryLabel}`,
    `表示言語: ${lang}`,
    "",
    "--- メッセージ ---",
    message,
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: context.env.CONTACT_FROM || DEFAULT_FROM,
      to: [context.env.CONTACT_TO || DEFAULT_TO],
      reply_to: stripNewlines(email),
      subject,
      text: body,
    }),
  });

  if (!res.ok) {
    console.error("Resend send failed", res.status, await res.text());
    return Response.json({ ok: false, error: "send_failed" }, { status: 502 });
  }

  return Response.json({ ok: true });
}

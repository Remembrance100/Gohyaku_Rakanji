// Mails the front desk today's cash access code, once every morning.
//
// The code itself is never stored — functions/_lib/cash-code.js derives it as
// HMAC(secret, "cash-code|" + today's date in JST), and both the staff lookup
// and the visitor's verification recompute it independently. This Worker does
// not re-derive it. It asks /api/staff-cash-code for the value the same way
// staff-code.html does, for two reasons: CASH_CODE_SECRET never has to be
// copied into a second place, and the daily mail doubles as a live test that
// the endpoint still works.
//
// Standalone Worker rather than a Pages Function for the same reason
// workers/contact/ is: the free Email Routing send_email binding is
// Workers-only.

import { EmailMessage } from "cloudflare:email";
import { buildMimeMessage, jstDateParts } from "../../_shared/mime.js";

const CODE_ENDPOINT = "https://tour.rakanji.org/api/staff-cash-code";
const STAFF_PAGE = "https://tour.rakanji.org/staff-code";
const FROM_NAME = "羅漢寺音声ガイド";

// Cloudflare does not retry a failed cron invocation, and this only fires once
// a day — a single transient blip would otherwise cost the front desk their
// code for the whole day. Three tries with a short backoff covers a restart or
// a momentary edge hiccup.
const ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchCode(env) {
  let lastError = "unknown";

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch(
        `${CODE_ENDPOINT}?key=${encodeURIComponent(env.STAFF_ACCESS_KEY)}`,
        {
          headers: { "User-Agent": "rakanji-daily-code/1.0" },
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!res.ok) {
        // 401 means STAFF_ACCESS_KEY here has drifted from the one set on the
        // Pages project; 500 means the Pages side lost its env vars entirely.
        lastError = `endpoint returned HTTP ${res.status}`;
      } else {
        const data = await res.json();
        if (/^\d{6}$/.test(data?.code || "")) return { code: data.code, date: data.date };
        lastError = "endpoint returned no usable code";
      }
    } catch (err) {
      lastError = err?.name === "TimeoutError" ? "endpoint timed out" : `${err?.message || err}`;
    }

    if (attempt < ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
  }

  return { error: lastError };
}

function codeEmail({ code, date, jst }) {
  return {
    subject: `【羅漢寺音声ガイド】本日のアクセスコード ${code}`,
    text: [
      "本日のアクセスコード",
      "",
      `        ${code}`,
      "",
      `有効日: ${jst.long}`,
      "コードは日本時間の深夜0時に自動的に切り替わります。",
      "",
      "─".repeat(24),
      "",
      "現金でお支払いのお客様に、上記のコードをお伝えください。",
      "お客様が決済画面で「現金」を選び、このコードを入力すると、",
      "24時間のツアーアクセスが有効になります。",
      "",
      `コードの再確認: ${STAFF_PAGE}`,
      "（パスフレーズが必要です）",
      "",
      `内部管理用の日付キー: ${date}`,
    ].join("\n"),
  };
}

// The front desk gets an email at the same time every morning whether or not
// the lookup worked. Sending nothing on failure would be indistinguishable
// from the cron never having run, and they'd find out at the counter.
function failureEmail({ reason, jst }) {
  return {
    subject: "【羅漢寺音声ガイド】本日のアクセスコードを取得できませんでした",
    text: [
      "本日のアクセスコードを自動取得できませんでした。",
      "",
      `日時: ${jst.long} ${jst.time}`,
      `理由: ${reason}`,
      "",
      "─".repeat(24),
      "",
      "お手数ですが、下記のページから直接ご確認ください。",
      `${STAFF_PAGE}`,
      "（パスフレーズが必要です）",
      "",
      "このページも表示できない場合は、サイト管理者にご連絡ください。",
    ].join("\n"),
  };
}

async function run(env) {
  const jst = jstDateParts(new Date());
  const result = await fetchCode(env);

  const { subject, text } = result.error
    ? failureEmail({ reason: result.error, jst })
    : codeEmail({ code: result.code, date: result.date, jst });

  await env.EMAIL.send(
    new EmailMessage(
      env.CODE_FROM,
      env.CODE_TO,
      buildMimeMessage({
        fromName: FROM_NAME,
        fromAddr: env.CODE_FROM,
        toAddr: env.CODE_TO,
        subject,
        text,
      }),
    ),
  );

  return result.error
    ? { ok: false, reason: result.error, sentTo: env.CODE_TO }
    : { ok: true, code: result.code, date: result.date, sentTo: env.CODE_TO };
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      run(env).then((summary) => {
        console.log(
          summary.ok
            ? `daily-code: sent ${summary.date} to ${summary.sentTo}`
            : `daily-code: FAILED (${summary.reason}) — fallback notice sent`,
        );
      }),
    );
  },

  // Manual run, so the morning mail can be tested without waiting for 08:00
  // JST. Fails closed: no DAILY_CODE_KEY set means no way in.
  async fetch(request, env) {
    const key = env.DAILY_CODE_KEY;
    const url = new URL(request.url);

    if (!key || url.searchParams.get("key") !== key) {
      return new Response("Not found", { status: 404 });
    }

    return Response.json(await run(env));
  },
};

// Uptime watchdog for tour.rakanji.org.
//
// Wakes on a cron, checks the site the way a visitor would, and emails when a
// check changes state — once when it breaks, once when it comes back. It does
// not email while a known outage continues, so a bad afternoon is two mails
// rather than a hundred.
//
// Runs as a standalone Worker for the same reason workers/contact/ does: the
// free Email Routing send_email binding is Workers-only, and Pages Functions
// would need the paid Email Sending API. It deliberately lives outside the
// Pages project so a broken Pages deploy — the thing most likely to take the
// site down — cannot take the watchdog down with it.

import { EmailMessage } from "cloudflare:email";

const SITE = "https://tour.rakanji.org";
const TOUR_API =
  "https://stg-apirakanjicom-stgrakanji.kinsta.cloud/?rest_route=/memorial/v1/tour";

// A check has to fail this many runs in a row before it alerts. Kinsta has
// normal latency spikes and a single request times out occasionally; alerting
// on one bad sample would cry wolf. At the 5-minute cron that means roughly
// 10 minutes from real breakage to email.
const FAILURES_BEFORE_ALERT = 2;

// Per-request ceiling. The tour endpoint answers in ~2s cold, so 15s is
// "slow but alive" rather than down.
const TIMEOUT_MS = 15000;

// The tour payload is ~900KB across 21 stops. The failure worth catching is
// WordPress answering 200 with an empty stops array — that's about 1KB, and it
// leaves every visitor a blank map while every status code stays green. This
// threshold separates that from a merely smaller tour; it is not a stop count.
const MIN_TOUR_BYTES = 50_000;

// Stop reading the body once we've seen enough to judge it. Saves pulling
// 900KB through the Worker every five minutes.
const READ_CEILING_BYTES = 64_000;

const STATE_KEY = "watchdog:state";

const CHECKS = [
  {
    name: "site",
    label: "Site root",
    url: `${SITE}/`,
    // Served from cache when Cloudflare has it, which is what a visitor gets
    // too — if the cache is still serving, visitors are still fine.
    expect: { contains: "Tour Entry" },
  },
  {
    name: "pay",
    label: "Payment page",
    url: `${SITE}/pay-select`,
    expect: { contains: "Select Payment" },
  },
  {
    name: "tour-api",
    label: "Tour content API",
    url: TOUR_API,
    expect: { contains: '"siteTitle"', minBytes: MIN_TOUR_BYTES },
  },
];

// Reads at most READ_CEILING_BYTES of the body, decoding only the first chunk,
// then cancels the stream. Returns the prefix for the substring assertion and
// a byte count that is exact below the ceiling and clamped at it above.
async function readPrefix(res) {
  if (!res.body) return { prefix: "", bytes: 0, truncated: false };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let prefix = "";
  let bytes = 0;

  try {
    while (bytes < READ_CEILING_BYTES) {
      const { done, value } = await reader.read();
      if (done) return { prefix, bytes, truncated: false };
      bytes += value.byteLength;
      if (prefix.length < 4096)
        prefix += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  return { prefix, bytes, truncated: true };
}

async function probe(check) {
  const started = Date.now();

  let res;
  try {
    res = await fetch(check.url, {
      redirect: "follow",
      headers: { "User-Agent": "rakanji-watchdog/1.0 (+uptime check)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const reason =
      err?.name === "TimeoutError"
        ? `no response within ${TIMEOUT_MS / 1000}s`
        : `request failed (${err?.message || err?.name || "unknown"})`;
    return { ok: false, detail: reason, ms: Date.now() - started };
  }

  const ms = Date.now() - started;

  if (!res.ok) {
    res.body?.cancel().catch(() => {});
    return { ok: false, detail: `HTTP ${res.status}`, ms };
  }

  const { prefix, bytes, truncated } = await readPrefix(res);

  if (check.expect.contains && !prefix.includes(check.expect.contains)) {
    return {
      ok: false,
      detail: `HTTP 200 but the page body is wrong (no ${check.expect.contains})`,
      ms,
    };
  }

  if (check.expect.minBytes && !truncated && bytes < check.expect.minBytes) {
    return {
      ok: false,
      detail: `HTTP 200 but only ${bytes} bytes - the tour is likely empty`,
      ms,
    };
  }

  return { ok: true, detail: `HTTP ${res.status} in ${ms}ms`, ms };
}

async function loadState(env) {
  try {
    return (await env.STATE.get(STATE_KEY, { type: "json" })) || {};
  } catch (err) {
    // A KV read failure must not stop the checks from running. Worst case we
    // treat everything as previously-healthy and re-alert once.
    console.error("state read failed", err?.message);
    return {};
  }
}

function formatJst(date) {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} JST`;
}

// Alert bodies are deliberately ASCII — they carry URLs, status codes and
// timings, so there is nothing to encode and no need for the RFC 2047 header
// machinery the contact Worker has to do for Japanese subject lines.
function buildMessage(env, { broke, recovered, results, test }) {
  const passing = results.filter((r) => r.ok).length;
  const headline = test
    ? `TEST - ${passing}/${results.length} checks passing`
    : broke.length
      ? `DOWN: ${broke.map((r) => r.label).join(", ")}`
      : `RECOVERED: ${recovered.map((r) => r.label).join(", ")}`;

  const lines = [`Detected ${formatJst(new Date())}`, ""];

  if (broke.length) {
    lines.push(test ? "CURRENTLY FAILING" : "FAILING");
    for (const r of broke) {
      lines.push(`  ${r.label}`);
      lines.push(`    ${r.url}`);
      lines.push(
        test
          ? `    ${r.detail}`
          : `    ${r.detail} (${r.fails} consecutive failures)`,
      );
    }
    lines.push("");
  }

  if (recovered.length) {
    lines.push("BACK UP");
    for (const r of recovered) {
      lines.push(`  ${r.label} - ${r.detail}`);
    }
    lines.push("");
  }

  const healthy = results.filter((r) => r.ok);
  if (healthy.length) {
    lines.push("STILL OK");
    for (const r of healthy) lines.push(`  ${r.label} - ${r.detail}`);
    lines.push("");
  }

  lines.push("-".repeat(52));
  if (test) {
    lines.push(
      "Test alert, sent on request. Receiving this confirms the whole",
    );
    lines.push("email path works: the send_email binding, the verified");
    lines.push("destination address, and the From address on the zone.");
  } else {
    lines.push("Automated check from the rakanji-watchdog Worker, which runs");
    lines.push(
      "every 5 minutes. You will get one more email when this clears.",
    );
  }

  const subject = `[rakanji] ${headline}`;
  const raw = [
    `From: Rakanji Watchdog <${env.ALERT_FROM}>`,
    `To: ${env.ALERT_TO}`,
    `Subject: ${subject}`,
    `Message-ID: <${crypto.randomUUID()}@rakanji.org>`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="us-ascii"',
    "",
    lines.join("\n"),
  ].join("\r\n");

  return raw;
}

async function runChecks(env) {
  const results = await Promise.all(
    CHECKS.map(async (check) => ({
      ...check,
      ...(await probe(check)),
    })),
  );

  const state = await loadState(env);
  const next = {};
  const broke = [];
  const recovered = [];

  for (const r of results) {
    const prev = state[r.name] || { fails: 0, alerted: false };

    if (r.ok) {
      if (prev.alerted) recovered.push(r);
      next[r.name] = { fails: 0, alerted: false };
      continue;
    }

    const fails = prev.fails + 1;
    const alerted = prev.alerted || fails >= FAILURES_BEFORE_ALERT;
    next[r.name] = { fails, alerted };

    if (alerted && !prev.alerted) broke.push({ ...r, fails });
  }

  if (broke.length || recovered.length) {
    try {
      await env.EMAIL.send(
        new EmailMessage(
          env.ALERT_FROM,
          env.ALERT_TO,
          buildMessage(env, { broke, recovered, results }),
        ),
      );
    } catch (err) {
      // Most likely ALERT_FROM isn't a custom address on the zone, or ALERT_TO
      // hasn't been verified as a destination. Don't persist the alerted flag
      // if the mail never went out, or the next run would stay silent about an
      // outage nobody was told about.
      console.error("alert send failed", err?.message);
      for (const r of broke) next[r.name].alerted = false;
    }
  }

  // Only write when something actually changed — keeps this far under the free
  // tier's 1,000 KV writes/day even at a 5-minute interval.
  if (JSON.stringify(next) !== JSON.stringify(state)) {
    await env.STATE.put(STATE_KEY, JSON.stringify(next));
  }

  return { checkedAt: new Date().toISOString(), results, broke, recovered };
}

// Sends one alert on demand, whatever the site's actual state. Needed because
// a healthy site produces no email by design — without this there'd be no way
// to prove the address is verified and the binding works short of waiting for
// a real outage. Touches no KV state, so it can't confuse the real alerting.
async function sendTestAlert(env) {
  const results = await Promise.all(
    CHECKS.map(async (check) => ({ ...check, ...(await probe(check)) })),
  );

  await env.EMAIL.send(
    new EmailMessage(
      env.ALERT_FROM,
      env.ALERT_TO,
      buildMessage(env, {
        broke: results.filter((r) => !r.ok),
        recovered: [],
        results,
        test: true,
      }),
    ),
  );

  return {
    test: true,
    sentTo: env.ALERT_TO,
    checkedAt: new Date().toISOString(),
    results,
  };
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      runChecks(env).then((summary) => {
        const bad = summary.results.filter((r) => !r.ok);
        console.log(
          bad.length
            ? `watchdog: ${bad.length} failing — ${bad.map((r) => `${r.name}: ${r.detail}`).join("; ")}`
            : "watchdog: all checks ok",
        );
      }),
    );
  },

  // Manual "run the checks now" endpoint, so setup can be verified without
  // waiting for the cron. Fails closed: with no WATCHDOG_KEY set, there is no
  // way in. workers_dev is off, so this is only reachable if you add a route.
  async fetch(request, env) {
    const key = env.WATCHDOG_KEY;
    const url = new URL(request.url);

    if (!key || url.searchParams.get("key") !== key) {
      return new Response("Not found", { status: 404 });
    }

    // ?test=1 always mails; without it you get the real state-change logic,
    // which stays silent when nothing has changed.
    if (url.searchParams.get("test") === "1") {
      return Response.json(await sendTestAlert(env));
    }

    return Response.json(await runChecks(env));
  },
};

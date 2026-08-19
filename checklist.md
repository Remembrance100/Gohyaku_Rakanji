# Updates

2026-08-19 — two new Workers. Neither is deployed yet.

---

## Watchdog — `workers/watchdog/`

Checks the live site every 5 minutes and emails when something breaks, running
three probes: site root, payment page, and the Kinsta tour API. Each asserts on
the response **body** rather than just the status code, because the failure worth
catching is WordPress returning `200` with an empty tour — the site pages must
contain `Tour Entry` and `Select Payment`, and the API must return at least 50KB
against a real payload of ~900KB and an empty one of ~1KB. It fails twice in a
row before alerting so latency spikes stay quiet, and emails only on state change
— one when it breaks, one when it recovers — so a two-hour outage is 2 emails
rather than 24. It lives outside the Pages project on purpose: a broken Pages
deploy must not be able to take down the thing that reports broken Pages
deploys. Alerts go to `linusfujisawa@gmail.com`, the binding locked to that one
address. Deploy with `cd workers/watchdog && npx wrangler deploy`; it needs no
secrets, and since an empty inbox is the correct result, the only way to tell
"running" from "not running" is Cloudflare → Workers & Pages →
`rakanji-watchdog` → Logs, which should show `watchdog: all checks ok` every 5
minutes. Still untested: the DOWN → RECOVERED cycle, and it says nothing about
whether anyone can actually pay.

## Daily code — `workers/daily-code/`

Mails the front desk the day's cash code at 08:00 JST (`0 23 * * *`, since cron
schedules are UTC), fetching it from `/api/staff-cash-code` rather than
re-deriving the HMAC so that `CASH_CODE_SECRET` stays in one place and the
morning email doubles as a live test of that endpoint. It retries three times and
still sends an email if all three fail, pointing at `staff-code.html` as the
fallback, because silence at 08:00 would look identical to the cron never having
run. **It is currently switched OFF** — `ENABLED = "false"` in its
`wrangler.toml`, because the Cash button is hidden in `pay-select.html` (commit
`f21249c`) and the code is unusable by visitors anyway; to turn it on, change
`"false"` to `"true"` and run `npx wrangler deploy`, which is the entire
procedure since the cron stays registered either way. Deploying also requires
`npx wrangler secret put STAFF_ACCESS_KEY`, since that passphrase currently
exists only in the gitignored `.dev.vars`. It mails `linusfujisawa@gmail.com` for
now, though the binding also permits `500@rakan.or.jp`, so pointing it at the
real front desk is a one-line `CODE_TO` change. One thing worth remembering:
`CASH_CODE_SECRET` is not set, so the code derives from `STRIPE_SECRET_KEY` —
rotating the Stripe key would silently change the temple code.

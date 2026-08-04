# PayPay relay setup

## The problem this solves

The PayPay merchant account restricts API access to IPs registered during
application. Cloudflare Pages Functions have **no fixed egress IP** — requests
leave from many rotating Cloudflare addresses — so every call came back
`Unauthorized request (08100016)`.

That error reads like bad credentials and isn't. The signing code was verified
correct, and PayPay's own official Node SDK was rejected with the same key from
a local machine, which ruled out our implementation entirely.

This WordPress host's outbound address is already on PayPay's allow list, so the
PayPay call happens here instead:

```
browser → tour.rakanji.org/api/*  (Cloudflare Pages)
        → this relay              (whitelisted IP)
        → apigw.paypay.ne.jp
```

Cloudflare keeps `TOKEN_SECRET` and still mints the 24-hour access token, so a
compromised relay cannot grant tour access by itself.

---

## Step 0 — confirm the egress IP first (do this before anything else)

**The whole approach depends on this.** PayPay has `161.33.186.30` on file, which
MyKinsta showed as the **Live** environment's "IP address for external
connections". The tour endpoint currently runs on **Staging**, and a staging
environment may egress from a different address.

In MyKinsta: switch the environment selector to **Staging** → **Info** → read
**IP address for external connections**.

- **Matches `161.33.186.30`** → continue below.
- **Different** → either run the relay on the Live environment instead, or ask
  PayPay to add the staging IP. Don't skip this: if the IP is wrong you'll get
  the same `08100016` and it will look like the relay failed when it didn't.

---

## Step 1 — install the relay

Paste [`paypay-relay.php`](paypay-relay.php) into the same file as the tour
endpoint (theme `functions.php` or the site-specific plugin). Skip its opening
`<?php` line if the file already has one.

## Step 2 — credentials into `wp-config.php`

Above the `/* That's all, stop editing! */` line:

```php
define('PAYPAY_API_KEY',      '...');  // 17 chars
define('PAYPAY_API_SECRET',   '...');  // 44 chars, base64, ends in '='
define('PAYPAY_MERCHANT_ID',  '...');  // 18 digits
define('PAYPAY_ENV',          'PROD'); // or 'STAGING'
define('PAYPAY_RELAY_SECRET', '...');  // generated in step 3
```

In `wp-config.php` rather than the database: these are credentials, and
wp-config.php isn't exposed by any REST route or backup export.

> The API secret is **44 characters** and ends in `=`. A previous outage was
> caused by the word `fountain` being pasted onto the end, making it 52 — that
> was the auto-translated name of the sender (泉 / Izumi) from the credentials
> email. Check the length.

## Step 3 — generate the shared secret

```
openssl rand -base64 32
```

The same value goes in `wp-config.php` as `PAYPAY_RELAY_SECRET` **and** in
Cloudflare as `PAYPAY_RELAY_SECRET`. They must match exactly.

## Step 4 — Cloudflare Pages environment variables

Settings → Environment variables:

| Name | Value |
| --- | --- |
| `PAYPAY_RELAY_URL` | `https://<wp-host>/?rest_route=/memorial/v1/paypay` |
| `PAYPAY_RELAY_SECRET` | same value as step 3 |

`PAYPAY_API_KEY`, `PAYPAY_API_SECRET` and `PAYPAY_MERCHANT_ID` are no longer
read by Cloudflare and can be removed once this works.

> **Cloudflare gotcha:** environment-variable changes only take effect on a
> **new deployment**. Push a commit or hit "Retry deployment" — editing the
> value alone leaves the old one live.

## Step 5 — re-enable the button

The PayPay option in `pay-select.html` is commented out, pending this work.
Uncomment it once a test payment succeeds.

---

## Verifying

`create` returns a PayPay checkout URL; `status` returns the payment state.
Both reject unsigned calls, so testing with a bare `curl` should return 401 —
that's the relay auth working, not a failure.

The relay surfaces PayPay's own error code, so if `08100016` comes back the IP
is still wrong (revisit step 0) rather than anything being broken in the code.

## What was verified before shipping

- The PHP `Authorization` header is **byte-identical** to the previously
  verified JS implementation for POST, GET and Unicode bodies, given the same
  nonce and epoch.
- Relay auth: valid signatures accepted; tampered body, wrong signature,
  replay past the 300s window, and missing headers all rejected.

## If PayPay drops the IP restriction

`functions/_lib/paypay-auth.js` and `crypto-md5.js` are kept for exactly that
case — the Pages Functions can go back to calling PayPay directly and this relay
can be deleted.

## Outstanding

The PayPay API secret was exposed in screenshots during debugging and **should
be rotated** before going live, independent of which approach ends up used.

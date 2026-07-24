# Memorial Tour System — Project Map

A plain language guide to how this project fits together: what each piece does, who owns it, and where to go when something breaks.

Last verified: 15 July 2026

---

## 1. What this project is

An interactive, audio guided memorial tour that visitors open on their phone at the temple 天恩山 五百羅漢寺. They walk from stop to stop, watch videos, and can buy an omamori (charm) at the end.

The whole thing is a **static website**. There is no traditional server. The pages are plain HTML and JavaScript files served straight from Cloudflare's global network. Anything that needs a real backend (tour content, videos, payments) is fetched from a separate service at run time.

**Live address:** https://tour.rakanji.org

---

## 2. The big picture

```
                        VISITOR'S PHONE
                              │
                              │  types tour.rakanji.org
                              ▼
                    ┌─────────────────────┐
                    │   DNS  (Kinsta)     │   answers "where do I go?"
                    └─────────────────────┘
                              │
                              ▼
        ┌───────────────────────────────────────────┐
        │        CLOUDFLARE PAGES                   │
        │        (the tour website itself)          │
        │                                           │
        │   index.html   the entry screen           │
        │   tour.html    the tour                   │
        │   pay.html     the checkout               │
        └───────────────────────────────────────────┘
                    │                    │
      asks for      │                    │  handles money
      content       │                    │
                    ▼                    ▼
      ┌──────────────────────┐   ┌──────────────────┐
      │  WORDPRESS (Kinsta)  │   │     STRIPE       │
      │                      │   │                  │
      │  tour text, videos,  │   │  card payments   │
      │  images, omamori     │   │                  │
      └──────────────────────┘   └──────────────────┘
```

In one sentence: **Cloudflare serves the app, WordPress supplies the content, Stripe takes the money, and Kinsta's DNS points the domain at Cloudflare.**

---

## 3. The pieces and who owns what

| Piece                | What it actually does                                                             | Where you manage it                     |
| -------------------- | --------------------------------------------------------------------------------- | --------------------------------------- |
| **Squarespace**      | Owns the domain name `rakanji.org`. That is all. It is the registrar.             | account.squarespace.com                 |
| **Kinsta DNS**       | The address book. Tells the internet that `tour.rakanji.org` lives at Cloudflare. | MyKinsta → DNS management               |
| **Cloudflare Pages** | Hosts and serves the tour website. Project name `smartsenior-gohyakurakanji`.     | dash.cloudflare.com → Workers and Pages |
| **Kinsta WordPress** | The content brain. Holds every tour stop, video, image, and omamori item.         | MyKinsta → Sites → `api.rakanji`        |
| **Stripe**           | Processes the omamori payments.                                                   | dashboard.stripe.com                    |
| **GitHub**           | Stores the code. Pushing to `main` triggers a new deploy.                         | github.com                              |

> **Important and easy to get wrong:** Squarespace shows a DNS editor with a list of records in it. **That editor does nothing.** The domain's nameservers point at Kinsta, so Kinsta is the only DNS that the internet actually reads. If you add a record in Squarespace it will look saved and will never take effect. Always edit DNS in **MyKinsta → DNS management**.

---

## 4. How a visitor moves through the app

```
  index.html                tour.html                  pay-select.html
  ┌──────────┐             ┌──────────┐               ┌──────────┐
  │  Entry   │  ────────▶  │  The     │  ──────────▶  │  Choose  │
  │  Stop 0  │             │  Tour    │               │  omamori │
  └──────────┘             └──────────┘               └──────────┘
   Welcome and              Walks through              Pick blue,
   language choice          each stop with             gold, or pink
   (JA / EN / ZH / KO)      video and audio                 │
                                                            ▼
                                                      ┌──────────┐
                                                      │ pay.html │
                                                      │ Checkout │
                                                      └──────────┘
                                                            │
                                                            ▼
                                                        Stripe
```

Errors are handled inline within the app; there is no separate error page.

---

## 5. How payment works

The website is static, so it cannot be trusted with a secret Stripe key. Two small pieces of server code handle that safely. They live in the `functions/` folder and run on Cloudflare automatically.

```
  pay.html                                              STRIPE
     │                                                     ▲
     │  1. "Start a checkout for the gold omamori"         │
     ▼                                                     │
  functions/api/create-checkout.js   ───────────────────▶  │
     │                                                     │
     │  2. sends the visitor to Stripe to pay              │
     ▼                                                     │
  visitor pays on Stripe's own page  ◀────────────────────-┘
     │
     │  3. comes back to the site
     ▼
  functions/api/verify-session.js
     │
     │  4. confirms the payment was real, then unlocks the omamori
     ▼
  visitor receives their charm
```

Two secrets make this work. They are **not** in the code and must never be committed:

- `STRIPE_SECRET_KEY` lets the site talk to Stripe.
- `TOKEN_SECRET` signs the proof that a visitor genuinely paid.

Locally they sit in `.dev.vars`. In production they are stored in the Cloudflare Pages project settings.

---

## 6. The domain chain, step by step

This is the part that caused confusion, so here it is in full.

```
  1. rakanji.org is BOUGHT from      ──▶  Squarespace  (registrar only)
                                              │
  2. but its nameservers point to    ──▶  Kinsta DNS
                                              │
  3. so Kinsta answers all lookups:           │
                                              │
        rakanji.org        ──▶  Kinsta WordPress   (the temple's main site)
        tour.rakanji.org   ──▶  Cloudflare Pages   (this tour app)
```

The record that makes the tour work is a single line in Kinsta DNS:

| Type  | Name   | Points to                      |
| ----- | ------ | ------------------------------ |
| CNAME | `tour` | `memorialtoursystem.pages.dev` |

Cloudflare then has to agree to answer for that name. It is registered under **Pages project → Custom domains** as `tour.rakanji.org`. Both halves are required. One without the other gives you a broken site.

**If the tour ever goes dark, check these three things in order:**

1. Does `tour.rakanji.org` still resolve? Run `dig +short tour.rakanji.org`. It should return `memorialtoursystem.pages.dev`.
2. Is the custom domain still Active in the Cloudflare Pages project?
3. Is the Kinsta WordPress site up? If WordPress is down the tour will load but appear empty, because the content never arrives.

---

## 7. How code gets deployed

```
  your laptop  ──git push──▶  GitHub (main branch)  ──auto──▶  Cloudflare Pages  ──▶  live
```

There is no build step. The repository root is published exactly as it sits (`pages_build_output_dir = "."` in `wrangler.toml`). What you commit is what visitors get.

**One thing the team must know.** The code lives in two GitHub repositories:

- `2fujisawa/MemorialTourSystemv2` is the `origin` remote on the working laptop.
- `Remembrance100/Gohyaku_Rakanji` is the repository **Cloudflare actually watches and deploys from.**

Both are currently on the same commit, so nothing is broken today. But a push that reaches only `2fujisawa/MemorialTourSystemv2` **will not deploy.** Before assuming a change is live, confirm it landed on `Remembrance100/Gohyaku_Rakanji`. Consolidating down to one repository would remove this trap entirely and is worth doing.

---

## 8. File map

| File                               | Purpose                                              |
| ---------------------------------- | ---------------------------------------------------- |
| `index.html`                       | Entry screen, Stop 0. Language selection.            |
| `tour.html`                        | The main tour experience.                            |
| `pay-select.html`                  | Choose which omamori to buy.                         |
| `pay.html`                         | Checkout screen.                                     |
| `assets/js/entry.js`               | Logic for the entry screen.                          |
| `assets/js/script.js`              | Logic for the tour. The largest file in the project. |
| `assets/css/`                      | Styling.                                             |
| `assets/icons/`                    | App icons.                                           |
| `functions/api/create-checkout.js` | Starts a Stripe payment.                             |
| `functions/api/verify-session.js`  | Confirms a Stripe payment was genuine.               |
| `wrangler.toml`                    | Cloudflare Pages configuration.                      |

---

## 9. Open issues the team should know about

### The live site is reading from a staging backend

This is the most important item on this page.

Every request for tour content, every video, and every image currently points at the **staging** WordPress install:

```
https://stg-apirakanjicom-stgrakanji.kinsta.cloud
```

That address appears in `assets/js/script.js` and `assets/js/entry.js` roughly a dozen times.

**Why this matters.** The tour is now on a public address that visitors can reach, but it is being fed by a staging server. Staging environments are routinely reset, paused, or left to drift out of date. If that happens the public tour will break or quietly show stale content. Before this is shown to the public, those addresses should be pointed at the production WordPress site.

### Leftover DNS record at Squarespace

There is a `tour` CNAME sitting in the Squarespace DNS panel. It does nothing, because Squarespace is not the active DNS provider. It should be deleted so that nobody in future reads it and believes DNS is configured there.

---

## 10. Quick reference

| Thing                       | Value                                           |
| --------------------------- | ----------------------------------------------- |
| Live site                   | https://tour.rakanji.org                        |
| Cloudflare fallback address | https://memorialtoursystem.pages.dev            |
| Cloudflare Pages project    | `smartsenior-gohyakurakanji`                    |
| Deploys from                | `Remembrance100/Gohyaku_Rakanji`, branch `main` |
| WordPress content API       | `/?rest_route=/memorial/v1/tour`                |
| DNS provider                | Kinsta                                          |
| Registrar                   | Squarespace                                     |
| Payments                    | Stripe                                          |

Stripe Check

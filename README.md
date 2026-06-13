# Memorial Tour Guide · SmartSenior

An interactive, multilingual audio tour PWA for memorial and temple grounds. Visitors purchase access via Stripe, then receive a 24-hour token that unlocks an interactive map with per-stop audio guides, image galleries, glossary terms, and a downloadable omamori gift at the end.

---

## Features

- **Multilingual** — Japanese, English, Korean, Traditional Chinese
- **Adjustable font size** — S / M / L, persisted across sessions
- **Interactive map** — pinchable/pannable SVG map with per-stop markers
- **Per-stop content** — audio guide, image gallery, transcript, and tappable glossary terms
- **Stripe payments** — one-time purchase, ¥1,500, 24-hour access token
- **Omamori gift screen** — downloadable animated GIF after completing the tour
- **PWA** — installable on iOS and Android, runs in standalone mode

---

## Pages

| File | Route | Purpose |
|---|---|---|
| `index.html` | `/` | Stop 0 intro — language/font settings, welcome video |
| `tour.html` | `/tour` | Main tour — interactive map and stop detail view |
| `pay.html` | `/pay` | Stripe checkout entry |
| `error.html` | `/error` | Payment or access error fallback |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS, HTML5, CSS3 |
| Hosting | Cloudflare Pages |
| Serverless API | Cloudflare Pages Functions |
| Payments | Stripe Checkout |
| Dev server | Wrangler CLI |
| PWA | Web App Manifest + Service Worker |

---

## Project Structure

```
.
├── index.html                  # Stop 0 entry page
├── tour.html                   # Main tour page
├── pay.html                    # Payment page
├── error.html                  # Error page
├── manifest.webmanifest        # PWA manifest
├── sw.js                       # Service worker
├── wrangler.toml               # Cloudflare Pages config
├── .dev.vars                   # Local environment variables (never commit)
├── assets/
│   ├── css/
│   │   ├── styles.css          # Main stylesheet (tour.html)
│   │   └── entry.css           # Entry page stylesheet (index.html)
│   ├── js/
│   │   ├── script.js           # Main tour logic
│   │   └── entry.js            # Entry page logic
│   └── icons/
│       ├── icon.svg            # App icon
│       └── icon-maskable.svg   # Maskable icon for Android
└── functions/
    └── api/
        ├── create-checkout.js  # POST /api/create-checkout — creates Stripe session
        └── verify-session.js   # GET  /api/verify-session  — verifies payment, issues token
```

---

## Local Development

### Prerequisites

- [Node.js](https://nodejs.org) (for Wrangler)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) — `npm install -g wrangler`
- A [Stripe](https://stripe.com) account

### Setup

**1. Clone the repo**

```bash
git clone <repo-url>
cd MemorialTourSystemV2
```

**2. Configure environment variables**

Create a `.dev.vars` file in the project root:

```
STRIPE_SECRET_KEY=sk_test_...
TOKEN_SECRET=your-random-secret-string
```

> `.dev.vars` is gitignored. Never commit real keys.

**3. Start the local dev server**

```bash
wrangler pages dev .
```

This runs the full Cloudflare environment locally including the API functions. Open `http://localhost:8788` in your browser.

> For UI-only work (no payments), you can use VS Code Live Server on port `5501` instead.

---

## Payment Flow

```
pay.html  →  POST /api/create-checkout  →  Stripe Checkout
                                                   ↓
tour.html  ←  GET /api/verify-session  ←  Stripe redirect (?session_id=...)
```

1. User clicks "Purchase" on `pay.html`
2. `/api/create-checkout` creates a Stripe Checkout session and returns the redirect URL
3. Stripe redirects to `tour.html?session_id=...` on success
4. `/api/verify-session` validates the session with Stripe, then issues a signed 24-hour HMAC token stored in `localStorage`
5. Subsequent visits check the token — no re-payment required within 24 hours

---

## Deployment

This project deploys to **Cloudflare Pages**.

**1. Push to GitHub** — Cloudflare Pages auto-deploys on push to `main`.

**2. Set environment variables in the Cloudflare dashboard:**

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe live secret key (`sk_live_...`) |
| `STRIPE_PRICE_ID` | (Optional) Stripe Price ID — overrides the inline ¥1,500 price |
| `TOKEN_SECRET` | Random secret string used to sign access tokens |

> These replace `.dev.vars` in production. Never use test keys in production.

**3. Manual deploy via Wrangler:**

```bash
wrangler pages deploy .
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `STRIPE_SECRET_KEY` | Yes | Stripe API secret key |
| `STRIPE_PRICE_ID` | No | Stripe Price ID — if set, overrides the hardcoded ¥1,500 inline price |
| `TOKEN_SECRET` | Recommended | HMAC signing secret for access tokens. Falls back to `STRIPE_SECRET_KEY` if unset |

---

## Access Control

> **Note:** The payment gate in `tour.html` is currently commented out for development. Re-enable the `<script>` block at the top of `tour.html` before going to production.

Access tokens are HMAC-SHA256 signed, base64-encoded, and expire after 24 hours. They are stored in `localStorage` and validated client-side on every page load.

---

## PWA

The app is installable as a PWA on iOS and Android via `manifest.webmanifest`. It runs in `standalone` display mode (no browser chrome) in portrait orientation.

To enable offline support, configure `sw.js` with a caching strategy appropriate for your content.

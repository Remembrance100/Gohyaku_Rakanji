## TODO

1. **PayPay — test one real payment.** Everything up to the checkout URL is
   working and live. Untested: what happens *after* paying — the redirect back
   to `tour.html`, `verify-paypay-payment`, and the 24h token. Buy one tour on a
   phone (¥1000, refundable from the PayPay merchant dashboard). If it lands on
   the tour unlocked, done; if it asks to pay again, the return leg is broken.

2. **Email to `500@rakan.or.jp`.** Pipeline works and is deployed, currently
   delivering to the developer's inbox.
   - [ ] Someone at the temple must click the verification link Cloudflare mails
         to `500@rakan.or.jp` (Email Routing → Destination addresses)
   - [ ] Then flip `destination_address` + `CONTACT_TO` in
         `workers/contact/wrangler.toml` and run
         `cd workers/contact && npx wrangler deploy` — this Worker deploys
         separately, git push will not do it

3. **Rotate two sets of credentials.**
   - [ ] PayPay API secret — exposed in screenshots and a chat transcript
   - [ ] Live WP auth salts + DB password — pasted into a chat 2026-08-04.
         Fresh salts: https://api.wordpress.org/secret-key/1.1/salt/

4. **Positioning of the stop buttons on the map.**

5. **Page speed — remaining items.** Images are done: 154MB → 73MB across the
   tour (809KB → 397KB average).
   - [ ] Re-save 8 oversized PNG screenshots as JPEG (~30MB, one is 8.5MB)
   - [ ] Optional: `sizes` on content images is WordPress's generic `100vw`
         rather than the real 358px display width, so browsers fetch larger
         files than needed — worth ~41% more on typical phones
   - [ ] Low priority: Kinsta staging has no edge caching, Live does. Matters
         less than first thought since the origin is already in Tokyo, and
         moving is a full content migration rather than a toggle.

---

### Reference

- PayPay architecture and setup: `wordpress/PAYPAY-RELAY.md`
- Tour endpoint (image sizing): `wordpress/README.md`
- PayPay's `08100016` was an **IP whitelist**, never the code. Calls now relay
  through Kinsta Live (`161.33.186.30`), the IP PayPay has on file.
- `TOKEN_SECRET` was never set on Cloudflare, so both payment providers sign
  access tokens with `STRIPE_SECRET_KEY` via a fallback. Works, but setting a
  real `TOKEN_SECRET` would be cleaner — change both verify endpoints together.

## TODO

1. **PayPay — test one real payment.** Buy a tour on a phone (¥1000, refundable) and check it unlocks instead of asking to pay again.

2. **Email destination.** Currently delivering to `linusfujisawa@gmail.com`; switch to `500@rakan.or.jp` once the temple clicks Cloudflare's verification link.
   - [ ] Temple verifies `500@rakan.or.jp` (Email Routing → Destination addresses)
   - [ ] Flip `destination_address` + `CONTACT_TO` in `workers/contact/wrangler.toml`, then `cd workers/contact && npx wrangler deploy`

3. **Rotate credentials.**
   - [ ] PayPay API secret — exposed in screenshots and chat
   - [ ] Live WP salts + DB password — https://api.wordpress.org/secret-key/1.1/salt/

4. **Map stop buttons.** Fix positioning.

5. **Page speed.** Images done: 154MB → 73MB.
   - [ ] Re-save 8 oversized PNG screenshots as JPEG (~30MB)
   - [ ] Optional: content-image `sizes` is generic `100vw`, not the real 358px — worth ~41% more
   - [ ] Low priority: move off Kinsta staging for edge caching (origin already in Tokyo, so minor)

---

### Reference

- PayPay setup: `wordpress/PAYPAY-RELAY.md` · tour endpoint: `wordpress/README.md`
- PayPay `08100016` was an IP whitelist, never the code — calls relay through Kinsta Live (`161.33.186.30`)
- `TOKEN_SECRET` is unset on Cloudflare; both providers sign tokens with `STRIPE_SECRET_KEY` via fallback
- The contact Worker deploys separately — git push does not deploy it

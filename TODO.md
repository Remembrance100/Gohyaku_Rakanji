## TODO

1. **PayPay — test one real payment.**
2. **Email destination.** Currently delivering to `linusfujisawa@gmail.com`; switch to `500@rakan.or.jp` once the temple clicks Cloudflare's verification link.
   - [ ] Temple verifies `500@rakan.or.jp` (Email Routing → Destination addresses)
   - [ ] Flip `destination_address` + `CONTACT_TO` in `workers/contact/wrangler.toml`, then `cd workers/contact && npx wrangler deploy`

3. **Map stop buttons.** Fix positioning.

4. **Page speed — done 2026-08-04.** Images 154MB → 73MB (809KB → 397KB average).
   - [x] Tour endpoint serves 1024px images instead of 2560px originals
   - [x] App no longer strips the size suffix back off (`script.js` + `entry.js`)
   - [x] Sanitiser keeps `srcset`/`sizes`/`width`/`height` instead of dropping them
   - [x] Hero image gets fetch priority; next/previous stop preloads while listening
   - [x] Preconnect to the media host

---

### Reference

- PayPay setup: `wordpress/PAYPAY-RELAY.md` · tour endpoint: `wordpress/README.md`
- PayPay `08100016` was an IP whitelist, never the code — calls relay through Kinsta Live (`161.33.186.30`)
- `TOKEN_SECRET` is unset on Cloudflare; both providers sign tokens with `STRIPE_SECRET_KEY` via fallback
- The contact Worker deploys separately — git push does not deploy it

- When scrolled to the button and click next at stop 4 and 15 it goes to the bottom of the page instead of the top of stop 5 and 16

- Also while on the page the bottom webpage shows the website name forever this takes up a lot of space so can you make it hide

- Top image load time

For the contact page, whwen the user clicks the certain language makes sure that the contact page reflects teh language

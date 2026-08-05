## TODO

1. **PayPay — test one real payment.**
2. **Email destination.** Currently delivering to `linusfujisawa@gmail.com`; switch to `500@rakan.or.jp` once the temple clicks Cloudflare's verification link.
   - [ ] Temple verifies `500@rakan.or.jp` (Email Routing → Destination addresses)
   - [ ] Flip `destination_address` + `CONTACT_TO` in `workers/contact/wrangler.toml`, then `cd workers/contact && npx wrangler deploy`

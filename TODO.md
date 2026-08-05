## TODO

1. **PayPay — test one real payment.**
2. **Email destination — DONE 2026-08-05.** Contact form now delivers to `500@rakan.or.jp`.
   - [x] Temple verifies `500@rakan.or.jp` (Email Routing → Destination addresses)
   - [x] Flip `destination_address` + `CONTACT_TO` in `workers/contact/wrangler.toml`, then `cd workers/contact && npx wrangler deploy`
   - [ ] Submit one real test through tour.rakanji.org/contact.html and confirm the temple received it

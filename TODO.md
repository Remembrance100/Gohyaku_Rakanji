## TODO

1. PayPay — relay built, waiting on install
   Root cause was never the code: PayPay restricts API access to whitelisted
   IPs and Cloudflare Pages has no fixed egress IP, so every call returned
   `08100016`. Kinsta's **Live** environment egresses from 161.33.186.30,
   which PayPay already has on file, so the call now goes through a relay
   there. See `wordpress/PAYPAY-RELAY.md`.
   - [x] Relay written + signing verified byte-identical to the JS version
   - [ ] Live `wp-config.php`: add the five PAYPAY_* defines
   - [ ] Live `wp-content/mu-plugins/paypay-relay.php`: paste the relay
   - [ ] Cloudflare: add PAYPAY_RELAY_URL + PAYPAY_RELAY_SECRET, then REDEPLOY
         (env changes need a new deployment, editing alone does nothing)
   - [ ] Uncomment the PayPay option in `pay-select.html` once a test pays
   - [ ] **Rotate the PayPay API secret** — it was exposed in screenshots
         during the original debugging. Deploying the existing one for now.
   - [ ] Rotate the Live WP auth salts + DB password (pasted into a chat
         2026-08-04): https://api.wordpress.org/secret-key/1.1/salt/

2. Verify the email that gets sent to 500@rakan.or.jp

3. Positioning of the stops buttons on the map

4. Email Direct sending
   - [ ] Email Routing → Destination addresses → add `500@rakan.or.jp`, someone
         at the temple must click the verification link Cloudflare mails there
   - [ ] Once verified: flip `destination_address` and `CONTACT_TO` in
         `workers/contact/wrangler.toml` to `500@rakan.or.jp`, then
         `cd workers/contact && npx wrangler deploy` (NOT git push — this
         Worker deploys separately from the Pages site)

5. Image resolution and page loading speed
   - [x] Tour endpoint now returns display-sized images instead of 2560px
         originals (`wordpress/memorial-tour-endpoint.php`) — measured 154MB →
         73MB across the tour, 809KB → 397KB average
   - [x] Frontend no longer strips the size suffix back off; sanitiser keeps
         `srcset`/`sizes`; hero image gets fetch priority; next/previous stop
         images preload while the visitor is listening

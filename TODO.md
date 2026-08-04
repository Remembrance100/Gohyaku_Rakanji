## TODO

1. Paypay Implementation - IP address issue

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

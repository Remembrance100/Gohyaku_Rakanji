## TODO

1. Paypay Implementation - IP address issue

2. Verify the email that gets sent to 500@rakan.or.jp

3. Positioning of the stops buttons on the map

4. Email Direct sending — code done in `workers/contact/` (standalone Worker, free
   Email Routing `send_email` binding — the Email Sending REST API needs the $5/mo
   Workers Paid plan, the binding does not). Remaining manual steps:
   - [x] Migrate rakanji.org DNS from Route 53 to Cloudflare nameservers
   - [ ] Email Routing → finish onboarding rakanji.org
   - [ ] Email Routing → Destination addresses → add `500@rakan.or.jp`, click the
         verification link Cloudflare mails there
   - [ ] Email Routing → Custom addresses → create `contact@rakanji.org`
   - [ ] Deploy: `cd workers/contact && npx wrangler deploy` (NOT git push — this
         Worker deploys separately from the Pages site)

5. Image Resultion shifter, and the pages loading speed

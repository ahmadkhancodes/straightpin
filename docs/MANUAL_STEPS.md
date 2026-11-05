# Manual steps for Straightpin (owner-only; deep link first). None block the build; stubs are used until done.

Everything else (DB user via MongoDB connector, Stripe test products via connector, Vercel project via token, Cloudflare Worker via token) is done by the build session. Items below appear only when their milestone needs them.

1. **Cloudflare token + account id as env vars** (needed M1 for the cron worker and DNS)
   https://dash.cloudflare.com/profile/api-tokens
   Create token: permissions Zone DNS Edit (buffersoltech.com), Workers Scripts Edit, R2 Edit. Save it as `CLOUDFLARE_SAAS_TOKEN`, plus `CLOUDFLARE_SAAS_ACCOUNT_ID` (shown on the dashboard sidebar) in the cloud environment.
   Done when: both env vars exist; the session adds the `straightpin` CNAME to Vercel.
2. **Resend API key** (needed M1 for email codes and alerts)
   https://resend.com/api-keys
   Create key "straightpin" (sending access), save as `RESEND_API_KEY`. Add and verify the domain `buffersoltech.com` at https://resend.com/domains (the session supplies the DNS records through the CF token).
   Done when: domain shows Verified.
3. **Stripe test secret key** (M1, only if the connector cannot create objects)
   https://dashboard.stripe.com/test/apikeys
   Reveal the test secret key, save as `STRIPE_SECRET_KEY_TEST`.
4. **Atlas upgrade to M10 (about $57/mo) before launch** (M4/M5, payment)
   https://cloud.mongodb.com/v2/6aeaf54cfcddba149e782d8d#/clusters
   Cluster buffersol-saas → Edit configuration → M10. Needed once active jobs pass about 300K documents (free M0 is 512 MB).
   Done when: cluster shows M10.
5. **Vercel Pro on the new account before taking real money** (M5, payment)
   https://vercel.com/account/billing
   Upgrade team `ahmad-code` to Pro (Hobby is non commercial, 60 s functions).
   Done when: plan shows Pro.
6. **Stripe live mode + business details** (launch, legal)
   https://dashboard.stripe.com/settings/business-details
   Complete activation, then the session swaps test keys for live.
7. **Trademark check** (launch, recommended)
   https://tmsearch.uspto.gov/ , https://www.ipo.gov.uk/tmcase/ , https://ised-isde.canada.ca/cipo/trademark-search/srch
   Search "Straightpin" in software classes 9, 35, 42. Fallback name: Straightboard.

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

8. **Fill the legal placeholders** (before taking real money, M5)
   Files: `src/config/product.ts` (`legal.jurisdiction`, `legal.address`) and `src/content/legal/terms.ts` (`{{liability cap}}`).
   Needed from the owner: the governing law and courts (`{{jurisdiction}}`), the registered address of BufferSol Technologies (`{{registered address}}`), and the liability cap wording (`{{liability cap}}`). They render as visible placeholders on /legal/privacy and /legal/terms until set. A lawyer should read the legal pages before launch.

## Added in M4 (launch prep)
9. **Placeholder inventory** (every `{{...}}` in `src/`; a unit test fails if one is missing here)
   - `{{jurisdiction}}`: `src/config/product.ts` (`legal.jurisdiction`). Governing law and courts.
   - `{{registered address}}`: `src/config/product.ts` (`legal.address`). Registered address of BufferSol Technologies.
   - `{{liability cap}}`: `src/content/legal/terms.ts`. Liability cap wording.
   Outside the code: `{{launch_job_target}}` (docs/ARCHITECTURE.md), set after the first full crawl.
10. **Redeploy the Cloudflare cron worker** (new `DAILY_JOBS`: `source-health`, `retention`)
    `cd infra/cron-worker && npx wrangler deploy` (needs the Cloudflare token). Full order in `docs/LAUNCH_CHECKLIST.md`.
11. **Run `npm run db:indexes` against Atlas** (new `alert_rules` collection and indexes).
12. **Review the seed source list** after the first live crawl: `/admin/crawl` shows disabled and unverified sources. See `docs/LAUNCH_CHECKLIST.md` section 5.

## Added in M5 (pre-launch review, see docs/REVIEW.md)
13. **Make sure `BETTER_AUTH_SECRET` is set in Vercel Production** (a long random value). Email unsubscribe and manage links now refuse to sign without it in production.
    https://vercel.com/dashboard → project straightpin → Settings → Environment Variables
14. **Decide on the refund rule** (optional): the code refunds the newest charge if it is under 7 days old, once per customer (D-038). The brief says the first charge only. To narrow it, say so and the build session changes `refundLatestCharge` and the policy text together.
15. **Before switching Plus on:** ship its features, set `onSale: true` in `src/config/product.ts`, and move the annual renewal reminder to 15 to 45 days before renewal (REVIEW P1-4).

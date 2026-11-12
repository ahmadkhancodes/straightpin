# Launch checklist: Straightpin by BufferSol

Work top to bottom. Items marked **owner** need a login, a payment or a legal decision. Everything else the build session can do. Nothing here has been done yet (M4 is code only).

## 1. Placeholders to fill (owner)
Every `{{...}}` in the code is listed in `docs/MANUAL_STEPS.md` (a test fails if one is missing there). Today:
- `{{jurisdiction}}` and `{{registered address}}` in `src/config/product.ts` (`legal`).
- `{{liability cap}}` in `src/content/legal/terms.ts`.
- `{{launch_job_target}}` (brief): the active job count to launch with. Decide it once the first full crawl is measured; it is not in code.
They show as highlighted text on /legal/privacy and /legal/terms until set. Grep before launch: `grep -rn "{{" src`.

## 2. Secrets and env (Vercel project env, never committed)
`BETTER_AUTH_SECRET` (also signs unsubscribe and manage-alert links: rotating it invalidates old email links), `CRON_SECRET`, `MONGODB_URI`, `STRIPE_SECRET_KEY` (live key only at step 6), `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`, `ADMIN_EMAILS`, `NEXT_PUBLIC_APP_URL`. Check `.env.example` for the full list. Test with the test keys first.

## 3. Database and indexes
1. Atlas: upgrade to M10 before the job count passes about 300K (MANUAL_STEPS 4).
2. `npm run db:indexes` against the production URI. M4 added `alert_rules` (org, active, email) and a `source_runs` index on `finishedAt`.
3. Retention is enforced by the daily `retention` cron (closed jobs and crawl records, see /about/data). The `source_runs` TTL index is a backstop with the same period.

## 4. Cron worker (Cloudflare)
`cd infra/cron-worker && npx wrangler secret put CRON_SECRET && npx wrangler deploy`.
- Every minute: `webhook-retries`, `crawl-tick`.
- Minute 0 of each hour: `digest`, `alerts`, `renewal-reminders`.
- 03:00 UTC daily (`DAILY_JOBS`, new in M4): `source-health`, `retention`.
Redeploy the worker once so the new variable takes effect. Check `/admin/crawl` an hour later: sources with a recent crawl, none stuck.
Vercel cron stays a once-a-day backstop only.

## 5. First crawl and the source list
1. Run `POST /api/cron/crawl-tick` by hand a few times with `CRON_SECRET`.
2. Open `/admin/crawl`. The seed list (`src/lib/jobs/sources.json`) is 64 entries, all `verified: false`. Slugs that 404 are disabled by the health check after 5 failed crawls; fix or remove them, then press Enable. Set `verified: true` for the ones that return jobs.
3. Check the agency review queue (`/admin/review`) and the "We removed N staffing agency posts" receipt.
4. Confirm the programmatic pages: `/jobs` lists combinations with at least 8 jobs; `/sitemap.xml` lists them.

## 6. Stripe live switch (owner)
1. Complete business activation (MANUAL_STEPS 6).
2. Run `npm run stripe:setup` against live keys (lookup keys `straightpin_<plan>_<interval>`, `metadata.app=straightpin`).
3. Add the live webhook endpoint `/api/stripe/webhook` and copy its secret into env.
4. Do one real purchase, one cancel and one refund with a real card, then refund yourself.
5. Vercel Pro before taking money (MANUAL_STEPS 5).

## 7. Trademark and legal review (owner)
- Name search for "Straightpin" in classes 9, 35, 42 at USPTO, UKIPO, CIPO (MANUAL_STEPS 7). Fallback name: Straightboard.
- A lawyer reads /legal/terms, /legal/privacy, /legal/refunds and the cookie notice (UK GDPR, CCPA, PIPEDA, auto-renew rules). Confirm the 30 day deletion claim in the privacy policy matches account deletion (it deletes at once).
- Add the O*NET attribution when the skills dictionary ships (v1).

## 8. Mail
Verify the sending domain in Resend (SPF, DKIM, DMARC). Send one digest, one instant alert and one renewal reminder to a real inbox; check the unsubscribe and "Change or delete your alerts" links work without login. Watch bounce under 2 percent and complaints under 0.1 percent.

## 9. Release gate (M5)
Lighthouse 90+, axe on every page, Playwright 375 and 1440 light in `docs/qa/`, design scorecard, Opus review of the diff, then deploy and run `scripts/vercel-keep-latest-3.sh straightpin`.

## 10. First 100 users (from the brief, in order)
1. Week 1: short screen-recorded videos of a real remote job that is missing from the big boards (TikTok, Reels, Shorts; 3 a day for 30 days). Show the first posted date and the direct link. No claim that anyone else's jobs are fake.
2. Reddit (r/jobs, r/remotework, r/WorkOnline, r/UKJobs, r/canadajobs): helpful answers only, where the rules allow. No spam.
3. X build-in-public thread each week with real numbers (founder account).
4. LinkedIn posts for people recently laid off.
5. Programmatic pages: submit `/sitemap.xml` to Search Console and Bing, watch the index count (target 200 pages by week 8).
6. Dated comparison pages (`/compare/directroles`); keep prices dated.
7. Canada and UK posts, then `/ca` and `/uk` pages.
8. Product Hunt, BetaList and TrustMRR once there is revenue.
9. Career-creator affiliates: 30 percent for 12 months, 3 to 5 active by week 10.
10. Track: quiz completion, signup rate, free to paid, refund rate under 8 percent, first 10 paying users.

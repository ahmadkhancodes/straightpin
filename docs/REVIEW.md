# Pre-launch review (M5, 5 Nov 2026)

Reviewer: Opus, from the code, not the PROGRESS summaries. Scope: money flows, crawl policy, product promise, security and
privacy, public claims, accessibility, ops. Nothing was deployed.

**Ranks.** P0 = must fix before launch (fixed in this change, each with a test that failed before the fix).
P1 = fix before or right after launch. P2 = worth doing, low risk today.

Line numbers point at the code after this change.

## P0: fixed in this change

### P0-1 Paid plans listed features that do not exist
- Where: `src/config/product.ts` (Monthly and Plus `highlights`), `src/lib/billing/checkout.ts:41`, `src/app/paywall/paywall-client.tsx:23`, `src/components/marketing/pricing-table.tsx:29`.
- What went wrong: Monthly ($10.99) promised an "Application tracker" and "Follow companies". Plus ($19.99/mo, $98.99/yr) promised the in-browser resume match check, the cover letter outline and 15 minute re-checks. None of these exist in `src/` (the brief puts them in v1). Plus could be bought on the paywall and through `/api/billing/checkout`. Every buyer would have paid for nothing, which means refunds, chargebacks (the brief's limit is under 0.5%) and consumer law trouble. The privacy policy also listed "application tracker notes".
- Fix: new `Plan.onSale` flag, with Plus set to `false`. Checkout refuses a plan that is not on sale with 409 `plan_not_on_sale`, whatever the client sends. The paywall only builds options from `plansOnSale()`. The pricing page shows Plus with "Not on sale yet" and no buy link. Monthly's highlights now list only real things (5 alerts, about half the weekly price over a month). The privacy line and `llms.txt` are corrected.
- Tests: `tests/unit/billing.test.ts` "P0-1" (Plus refused, no Stripe session; no plan on sale names a missing feature), `tests/e2e/billing.spec.ts` (no Plus option on the paywall).

### P0-2 The apply link was in the public HTML, so anyone could skip the open limit
- Where: `src/lib/jobs/jobPostingLd.ts:25`.
- What went wrong: the JobPosting JSON-LD on every open job page set `url` to `job.applyUrl`, the employer link that "Apply at company" sells (5 opens a day on Free, unlimited when paid). Anyone signed out could read it in view-source, and so could every crawler. That turns the main paid feature into a free one.
- Fix: `url` now points at our own job page (`/job/<id>`). The apply link is only ever returned by `POST /api/jobs/[id]/open`, after metering. Google does not require `url` on JobPosting.
- Tests: `src/lib/jobs/m4.test.ts` (url is the job page and the script has no apply link), `tests/e2e/seo.spec.ts` (the rendered job page has no external `/jobs/` link).

### P0-3 The crawler followed redirects past the deny list, private addresses and robots.txt
- Where: `src/lib/jobs/transport.ts:8`, `src/lib/crawl/net/fetchPolite.ts` (`fetch`, `fetchOne`, `robotsFor`).
- What went wrong: the transport used `fetch(..., { redirect: "follow" })`. `fetchPolite` only checked the first URL. A career site, a sitemap entry or a `<loc>` that redirects to indeed.com, linkedin.com or a private address (169.254.169.254) was fetched anyway, and robots.txt was never read on the target host. That breaks DATA-11 ("never crawl Indeed, LinkedIn, Glassdoor or directroles.net"), the "0 robots violations" promise on `/bot`, and it opens an SSRF path.
- Fix: the transport uses `redirect: "manual"`. `fetchPolite` follows at most 5 redirects itself, and each hop goes through `assertAllowedHost`, the target host's robots.txt and its rate limit. robots.txt redirects are followed the same way (RFC 9309), and more than 5 hops counts as "no robots file".
- Tests: `src/lib/crawl/net/fetchPolite.test.ts` "redirects" (denied host, private IP, the target's robots.txt, relative redirect, loop stops after 5 hops), `tests/unit/product.test.ts` (transport stays manual).

### P0-4 A customer could end up paying for two plans at once
- Where: `src/lib/billing/checkout.ts:44-52` (lines 47 and 52).
- What went wrong: only the paywall button was disabled for paid users. The server let an active Monthly or Weekly subscriber buy Lifetime ($23.99). The subscription kept renewing after that, and nothing cancelled it. A Lifetime holder could also start a subscription.
- Fix: Checkout refuses with 409 `already_subscribed` when the org holds Lifetime or has a live (active, trialing or past_due) subscription for this app. This happens before a Lifetime slot is claimed.
- Tests: `tests/unit/billing.test.ts` "P0-4" (two cases; no session created and no slot taken).

### P0-5 The refund policy promised more than the code does
- Where: `src/content/legal/refunds.ts:13`, `src/content/docs/billing.ts:26`.
- What went wrong: the legal policy said "7 day refund on every payment", covering Plus. The code (D-023) refunds once per Stripe customer, and admins are held to the same rule. A second request within 7 days would be refused even though the policy promises it. The policy also told people to "Open Billing in the app", but the consumer page is `/account`.
- Fix: both texts now say one refund per customer, self serve in Account or by email, and that the refund ends the plan right away. Cancel points at Account. Plus is removed from the list.
- Tests: `tests/unit/product.test.ts` "P0-5".

### P0-6 Hero claimed "thousands of company hiring pages"
- Where: `src/app/(marketing)/page.tsx:122`.
- What went wrong: the brief's subhead was used word for word, but the source list has 64 seed boards, all `verified: false` (D-030). That is a false claim in the first screen.
- Fix: "We check company hiring pages every hour, …". The hourly part is true: `CRAWL_INTERVAL_MS` is 1 h and the worker ticks every minute. Put "thousands" back once `/admin/crawl` shows that many active boards.
- Tests: `tests/unit/product.test.ts` "P0-6".

## P1: fixed here because they were small and safe

- **P1-6 Email link key fell back to a public constant.** `src/lib/mail/index.ts:19`: without `BETTER_AUTH_SECRET`, unsubscribe and manage-alert links were signed with `"dev-unsubscribe-secret"`. Anyone could then forge a manage link and delete another person's alerts. Production now throws instead of using the fallback.
- **P1-7 One failed email stopped the whole hourly run.** `src/lib/jobs/digest.ts` (`trySend`): a single throw from the mail provider (outage, bad address) aborted `runDigest` or `runAlerts` for everyone after that person. Now each failure is counted (`failed`) and logged, the person is not marked as sent, and the run carries on. Test: `src/lib/jobs/jobs.test.ts` "one failed email…".

## P1: open

1. **Disputes do not end the plan.** `src/lib/billing/webhook.ts`: `charge.dispute.*` events carry no `customer`, so they are recorded and ignored. A buyer can dispute a Lifetime payment and keep the plan. Fix: on `charge.dispute.created`, retrieve the charge and treat it like a full refund (revoke Lifetime, cancel subscriptions). Add a test with the fake.
2. **A refund again after deleting the account.** `src/lib/db/mongo.ts:451`: account deletion removes `billing_accounts`, so a new sign-up with the same email gets a new Stripe customer, and the once-per-customer rule (keyed by customer id) allows another refund. Fix: also key `refunds` by lowercased email, or keep a hashed-email tombstone.
3. **The refund covers the latest charge, not the first one.** `src/lib/billing/lifecycle.ts:44`: the brief says "auto-refunds if first charge <=7 days old". The code refunds the newest charge if it is under 7 days old (once). That is more generous and now matches the policy text (D-038). The owner should confirm. For a Lifetime holder with older subscription charges, the newest charge may not be the Lifetime one.
4. **Annual renewal reminder comes on the day of renewal.** `src/lib/billing/reminders.ts:22`: California's auto-renewal law asks for notice 15 to 45 days before an annual renewal. This does not matter while Plus annual is off sale. Fix it before turning Plus on.
5. **The health route never touches Mongo.** `src/app/api/health/route.ts`: it always returns `ok: true`, so uptime checks stay green while the database is down. Fix: ping the DB with a 2 s timeout and return 503 on failure.
6. **One-click GET unsubscribe.** `src/app/api/mail/unsubscribe/route.ts:24`: link scanners that prefetch GET URLs unsubscribe people. Fix: GET shows a confirm button that POSTs. The RFC 8058 POST stays.
7. **A failed digest is lost for the day.** After P1-7, a failed send is not marked, but `isDigestHour` only matches 08:00 local, so the next try is the next day. Allow a 3 hour catch-up window.
8. **Stripe paths are only tested against the fake** (`tests/unit/fakes.ts`). Run Checkout, the webhook, refund and cancel once in Stripe test mode before taking money (LAUNCH_CHECKLIST).
9. **Accessibility audit not run.** The e2e suite checks 375 px overflow on the main pages and 44 px close targets. No axe-core or keyboard sweep was run in this review, and the brief asks for axe on every page.
10. **Lifetime slots can be held by sign-up spam.** `src/lib/billing/checkout.ts:56`: each org holds a slot for 31 minutes per open Checkout. Many throwaway accounts could make Lifetime look sold out. This is limited by the billing rate limit, disposable-email blocking and magic-link sign-in. Watch `lifetimeSold` against paid count.

## P2

- `src/lib/billing/webhook.ts:30`: two copies of the same event delivered at the same moment can both process it. Harmless today, because every branch recomputes from Stripe or is idempotent per org.
- Kit routes still mounted: `/api/webhooks*`, `/api/v1/me`, API keys, and the `/app/billing` page. They are SSRF guarded and org scoped, but they are not part of the product. Remove them to shrink the attack surface.
- `cookieCache` at 300 s (`src/lib/auth/index.ts:67`): a deleted or suspended user's session cookie can keep working for up to 5 minutes. Suspension is also checked on the open and checkout routes.
- Individual job URLs are not in the sitemap (D-035).

## Areas reviewed with no finding

- Webhook signature on the raw body. The event id is recorded only after success. Other apps' customers and lookup keys are ignored. Entitlement is recomputed from Stripe. No client flag grants a plan (`/api/billing/entitlement?refresh=1` asks Stripe).
- Lifetime cap: atomic claim, released on session failure, on expiry and on a full refund.
- Refund reservation is written before Stripe is called, with an idempotency key. Partial refunds are ignored.
- Two-tap cancel goes through `cancel_at_period_end`.
- Prices: every amount on the paywall, pricing table and hero comes from `product.ts`. They match the brief (4.99 / 10.99 / 23.99 / 19.99 / 98.99).
- Open and save meters: atomic, rolled back when over the limit. Saved jobs and alerts are scoped by the session org (no IDOR). Manage links are HMAC signed per email with a key separate from unsubscribe links.
- Admin APIs all call `requireAdmin` (404 otherwise). Dev routes return 404 unless `E2E_OUTBOX=1`.
- Email templates escape every interpolated value. JSON-LD escapes `<`.
- Stored job content is facts plus an excerpt of at most 600 characters. Agency rules only; "Direct to company" only shows when `agencyFlag === "no"`. Sample data on the landing page is labelled.
- `crawl-tick`: 40 s budget under the 60 s `maxDuration`. Worker schedules match `cronJobs`.

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

Status 10 Nov 2026. Items 1 to 7 and 9 are fixed (tests named). Items 8 and 10 stay open: they need the owner or an external system (reasons below).

1. **FIXED. Disputes do not end the plan.** `src/lib/billing/disputes.ts`, wired in `webhook.ts`. `charge.dispute.created` retrieves the charge, finds the customer, saves the plan held and switches it off (Lifetime too); a hold (`applyDisputeHold`) stops later subscription events, replayed payments and `/api/billing/entitlement?refresh=1` from bringing it back. `charge.dispute.closed` won (or `warning_closed`) restores it (Lifetime from the saved record, subscriptions recomputed from Stripe); lost keeps it off, cancels subscriptions and frees a Lifetime slot. Each case writes an audit entry (`billing.dispute_opened`, `_won`, `_lost`). Tests: `tests/unit/p1.test.ts` "P1-1 disputes" (7 cases).
2. **FIXED. A refund again after deleting the account.** The once-per-customer rule now also keys on the lowercased billing email, stored only as a hash in `refunds` (second key `app:email:<hash>`), so it survives account deletion and a new Stripe customer. The email is the one on the billing account, which comes from the magic-link sign-in (verified by clicking the link). Tests: "P1-2".
3. **FIXED. The refund covered the latest charge, not the first.** The brief says "first charge <=7 days old". `firstRefundableCharge` (`src/lib/billing/lifecycle.ts`) reads every page of charges and takes the oldest successful one; the self-serve window runs from that charge. The refund policy, billing help, terms, FAQ, pricing promise, account page and API error text all say "first payment". Tests: "P1-3" and `tests/unit/product.test.ts`.
4. **FIXED. Annual renewal reminder.** Sent from 21 days before renewal (`ANNUAL_REMINDER_LEAD_DAYS`, never under 14), still once per renewal date. Plus stays `onSale: false`. Tests: `tests/unit/m3.test.ts` "annual".
5. **FIXED. The health route.** `/api/health` reads the database with a 2 s limit and returns 503 with `ok: false` when it throws or hangs. Tests: `tests/unit/routes.test.ts`.
6. **FIXED. One-click GET unsubscribe.** GET shows a "Yes, unsubscribe" button and writes nothing. The button POSTs (`confirm=1`) and gets a result page. The RFC 8058 POST (`List-Unsubscribe=One-Click`) still unsubscribes and answers in plain text. Tests: `tests/unit/routes.test.ts`.
7. **FIXED. A failed digest was lost for the day.** `isDigestHour` now covers 08:00 to 10:59 local (`DIGEST_CATCHUP_HOURS`); the 20 h guard on `lastDigestAt` still keeps it to one a day. Test: `src/lib/jobs/jobs.test.ts` "a failed digest is retried". Original text: After P1-7, a failed send is not marked, but `isDigestHour` only matches 08:00 local, so the next try is the next day. Allow a 3 hour catch-up window.
8. **OPEN (needs the owner and Stripe test mode, cannot be done in code).** Stripe paths are only tested against the fake** (`tests/unit/fakes.ts`). Run Checkout, the webhook, refund, cancel and a test dispute once in Stripe test mode before taking money (LAUNCH_CHECKLIST). Subscribe the webhook endpoint to `charge.dispute.created` and `charge.dispute.closed` (MANUAL_STEPS item 16).
9. **FIXED. Accessibility audit.** `tests/e2e/a11y.spec.ts` runs axe-core (already installed through eslint-plugin-jsx-a11y, no new dependency) at 375 px, light, on `/`, `/paywall`, `/quiz`, `/matches`, `/job/[id]`, `/account` and `/pricing`, and fails on serious or critical findings. Found and fixed on `/`: the scroll-reveal tagline dimmed unread words with opacity 0.3 (colour contrast; now `--text-subtle`), and the sample "Apply at company" button had an `aria-label` that did not contain its visible text (label removed, extra context is screen-reader-only text). No keyboard sweep was done beyond axe.
10. **OPEN (accepted risk, needs live data to judge; mitigations exist).** Lifetime slots can be held by sign-up spam.** `src/lib/billing/checkout.ts:56`: each org holds a slot for 31 minutes per open Checkout. Many throwaway accounts could make Lifetime look sold out. This is limited by the billing rate limit, disposable-email blocking and magic-link sign-in. Watch `lifetimeSold` against paid count.

## Launch hardening, 10 Nov 2026

- **Webhook.** Re-read against production reality. Subscription, invoice and checkout events recompute from Stripe, so order does not matter; duplicates are dropped by event id; the id is only recorded after success, so a failure returns 500 and Stripe retries. New: unknown event types are logged and answered 200; a late or retried `charge.refunded` no longer cancels a subscription created after the refund event (`cancelAppSubscriptions(..., createdBeforeSec)`). Grants never rely on the success redirect: `/api/billing/entitlement?refresh=1` asks Stripe, and the webhook is the source. Tests: `tests/unit/hardening.test.ts`.
- **Mail when Resend rejects.** Magic link and invite mail (`sendAuthMail`) log and swallow a provider error, so sign-in answers like a success and no provider text reaches the client. Renewal reminders count a `failed` send and carry on (before, one rejection aborted the run; that reminder is not retried, since it is claimed first). Digests and alerts already did this (P1-7); the refund email already swallowed errors. Tests: `tests/unit/hardening.test.ts`.

## Battle hardening, 12 Nov 2026

- **Closed:** P2 kit routes removed (`/api/webhooks*`, `/api/v1/me`; e2e asserts 404). The Better Auth API-key plugin endpoints under `/api/auth/api-key/*` remain: removing the plugin changes the auth schema, so it stays open, low risk (org scoped, no product route reads keys).
- **Closed:** P2 `cookieCache` 300 s -> 60 s (a suspended or deleted user's cookie works for at most a minute).
- **Closed:** QA P3 raw JSON on failed form posts: every form route now ends on `/problem` (what happened, what to do, a way back; same-site `back` only). QA P3 400-character e-mail accepted: sign-in form refuses over 254.
- **New, fixed:** magic link and invite mail had no per-address cap (`authEmail`/`authIp` rules existed but were unused): per-inbox cap of 5 per 10 minutes (hashed key, answer unchanged), 20 invites per inviter per hour, Better Auth custom rules on magic-link send and verify. Public and signed routes (`/api/saved`, `/api/alerts`, `/api/alerts/manage`, `/api/profile`, `/api/jobs/[id]/open`, `/api/counts`, `/api/altcha`, unsubscribe) now rate limit by org or IP and answer 429 with Retry-After; a broken limiter store lets requests through.
- **New, fixed (CSP):** Apply without JavaScript redirected the form post to the employer; `form-action` would swallow it. It now answers a link page. A static audit test checks every client fetch/socket/script/iframe/form action against the CSP, and a real browser sweep (`tests/e2e/qa/hardening.spec.ts`) fails on any violation across the signed-in pages and the Save form.
- **New, fixed:** log values are scrubbed of addresses and long tokens, not only keys. `/api/health` reports `up/down` per dependency (db decides the status; billing and mail show configured or not) with no hostnames or error text. Indexes added for lookups by user and e-mail (member, session, account, invitation, twoFactor, passkey) and the retention sweeps (saved_jobs.jobId, job_opens.orgId).
- **Webhook:** already covered by `tests/unit/billing.test.ts` (bad signature -> 400, duplicate dropped, out of order converges) and `hardening.test.ts`; unchanged.
- **Still open:** P1-8 (Stripe test-mode run, owner), P1-10 (Lifetime slot spam, live data), P2 concurrent duplicate Stripe event delivery (idempotent per branch), P2 job URLs not in the sitemap (D-035), intermittent hydration #418 on first `/sign-in` (needs a dev build), personal workspace for job seekers (design call).

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

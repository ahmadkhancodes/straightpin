# QA report: battle test of every P0 journey (12 Nov 2026)

Method: real production build (`next start`, memory driver, e-mail outbox, console mail) driven by Playwright as the ICP (a job seeker): signed out, new free user, user at the free limits. Specs: `tests/e2e/qa/` (apply, crawl, journeys). Unit regressions: `tests/unit/{auth-error,copy-limits,proxy-escape}.test.ts`. Not deployed.

## Journeys covered
- Visitor: landing, pricing, compare, how-we-check, docs, legal, /bot, /about/data, /jobs, quiz, matches: every page at 375 and 1440, signed out and signed in, every internal link followed, console/page errors, failed requests, horizontal scroll, accessible names, pointer cursor.
- Visitor tries Save / Apply on a job: sent to sign in and returned to the job.
- Sign in with the e-mail link (form -> outbox -> link -> onboarding); empty, malformed, padded, hostile and very long addresses; reused/expired link notice.
- Onboarding: empty, HTML/unicode organization name (rendered as text).
- Free user: quiz -> matches -> job -> Apply at company (opens employer tab), 5 opens then paywall that says why, re-open of an already opened job is free, save / unsave, saved list full (10) explains itself.
- Alerts page: daily digest off/on, with honest confirmation.
- Pricing / billing: plan buttons hand off to billing, stub checkout answers calmly, Plus (not on sale) cannot be bought, free user has no cancel/refund.
- Settings: profile name (hostile, empty), data download, delete dialog (Escape, Cancel, typed confirmation), app menu, sign out then `/app` redirects to sign in.
- Another user cannot see my saved jobs; non-admins are kept out of /admin pages and APIs; export needs a session.
- Keyboard: Tab reaches the sign-in action; Escape closes dialogs and returns focus.
- Mobile 375: no tap target under 44px on any public or app page; unknown and malformed URLs.

## Defects found and fixed
1. **"Apply at company" did nothing (P0).** It was a form POST answered with a 303 to the employer; CSP `form-action 'self'` blocks that redirect, so the main button of the product was dead in Chrome. Now a client button opens the tab on click, asks the API for the URL (JSON) and sends the tab there; limit goes to /paywall, errors are shown. (`apply-button.tsx`, `tests/e2e/qa/apply.spec.ts`.)
2. Signed in but without an organization, Apply / Save bounced to sign-in, which bounced straight back: a loop with no message. Apply now goes to /onboarding and keeps the job; onboarding keeps `next` through sign-in.
3. Sign-in with a malformed address that passes the client check showed "[body.email] Invalid email address". Developer validation messages are never shown now.
4. Alerts "Save settings" with the daily email Off redirected to /matches saying "Your daily email is on". Now returns to /alerts with "Settings saved. The daily email is off/on."
5. Billing page showed an enabled "Not on sale yet" button for Plus that failed with a generic error. Disabled, with the reason; the API error has its own message.
6. Free-limit numbers on the job and matches pages were hard coded; they read the plan config now, and a unit test guards the copy elsewhere against the config.
7. Tap targets under 44px on mobile: logo link (app shell, sign-in), Monthly/Yearly toggle, small buttons ("Sign out other sessions"), "All plans". Also the 24px rule for in-text links no longer overrides `min-h-11` (it was unlayered CSS beating Tailwind utilities, which made "The full comparison" 24px).
8. Broken percent escapes in a URL (`/job/%E0%A4%A`) gave a 500 on every dynamic route; now a plain 400 (proxy).
9. Empty or non-form POST to `/api/saved`, `/api/profile`, `/api/alerts`, admin routes threw a 500; treated as empty input.
10. Two stale tests fixed (support address is now contact@buffersoltech.com; the landing tap-target test was failing on main).

## Battle hardening round (12 Nov 2026)
Added: saved jobs CSV download (formula-safe, no apply links), first-run "Get started" checklist on `/app`, `/problem` page for failed form posts, rate limits and per-inbox mail caps, Apply link page without JavaScript, health route with no details, extra indexes. Tests: `tests/unit/battle.test.ts` (tenant isolation across saved, alerts, manage links, opens and export; guessed ids; rate limits; database down; huge and hostile input; double submit; concurrent Apply; CSV; log scrubbing; health), `tests/unit/csp-audit.test.ts` (CSP vs every origin in the source, secrets grep of `.next/static`), `tests/e2e/qa/hardening.spec.ts` (CSP violation sweep, CSV, checklist, problem page, no-JS Apply, headers, stale session). Closed from the list below: the 400-character e-mail and raw JSON on failed form posts.

## Open
- **P2, intermittent:** React hydration error #418 on the first `/sign-in` load after a server start, only in some sequences; not reproducible in isolation and the SSR/DOM `main` markup is identical. The crawl spec ignores exactly this error on /sign-in. Needs a look with a dev build.
- **P2, design call:** a job seeker must "Name your organization" after the first sign-in, and `/app` is organization-shaped. Consider auto-creating a personal workspace.
- Not testable locally: real Stripe checkout return and portal (stub mode answers 503 `billing_unavailable`), real mail delivery, passkeys and authenticator setup.

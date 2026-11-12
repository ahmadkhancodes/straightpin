# Adversarial security review (12 Nov 2026)

Reviewer: Opus, acting as an attacker with a normal account. Code, tests and docs only. Nothing was deployed.
The earlier reviews (`docs/REVIEW.md`, `docs/QA-REPORT.md`) covered billing, webhooks, the crawler's deny list, CSRF on
app routes, rate limits and log scrubbing. This pass attacked the parts those reviews did not: the Better Auth plugin
endpoints (`/api/auth/*`), redirect parameters, crawler egress through DNS, and the E2E-only routes.

Every finding has an exploit test. Each test **failed before the fix** (5 of the 7 unit cases were run against the stashed
fix; the browser open redirect was re-run against an unfixed build and the browser left the site) and passes now.

- Unit: `tests/unit/adversarial.test.ts` (real Better Auth handler, memory DB, outbox mail, two users in two organizations).
- Browser and API: `tests/e2e/qa/adversarial.spec.ts` (production build via `next start`, where Better Auth's origin checks are live).

## Threat model

**Assets.** Sign-in (magic links, session cookies, passkeys, TOTP); a person's search profile, saved jobs, alerts,
e-mail address and digest settings; the paid plan (Weekly, Monthly, Lifetime with a 1,000 cap) and the free daily
limits (5 opens, 10 saves); the employer apply links (the thing the open limit sells); the founder admin area
(suspend, refund, review queue, crawl health); the Stripe customer and refund rule (once per customer); mail
reputation of the sending domain; the crawler's network position (Vercel functions); secrets in env vars.

**Actors.** (1) A signed-in free user who wants paid features free or wants to read or change another person's data.
(2) A paying user who wants to share the plan. (3) A signed-out attacker on the internet: sign-up floods, mail bombing
through our domain, phishing through our redirects, credential replay. (4) A hostile or compromised employer job board
whose data we crawl (titles, links, sitemaps, redirects). (5) A misconfigured deployment (wrong env var).

**Entry points.** Better Auth under `/api/auth/*` (magic link, organizations, API keys, passkeys, two-factor, user);
app routes `/api/saved`, `/api/saved/export`, `/api/alerts`, `/api/alerts/manage`, `/api/profile`,
`/api/jobs/[id]/open`, `/api/counts`, `/api/account`, `/api/account/export`, `/api/audit`, `/api/billing/*`,
`/api/admin/*`, `/api/mail/unsubscribe`, `/api/stripe/webhook`, `/api/cron/[job]`, `/api/dev/*`, `/api/health`,
`/api/config`, `/api/altcha`; pages that take `next` / `back` / `from`; e-mail links (magic link, manage, unsubscribe);
the crawler (third-party JSON, HTML, sitemaps and redirects).

## Findings, by severity

### SEC-2 High: a paying owner could share the plan with anyone, and invite mail was a phishing relay (fixed)
- **Attack.** The members UI was removed earlier, but Better Auth's `POST /api/auth/organization/invite-member` and
  `accept-invitation` were still live. The plan and the free limits belong to the organization, so a Lifetime ($23.99)
  buyer could invite any number of friends, and each of them used the plan on their own account. The brief sells no
  seats until v2. The invite e-mail also went out from our domain with an organization name the sender chose (for example
  "Claim your refund at evil.example"), which is a phishing relay with our DKIM on it.
- **Proof.** Before the fix, the invite returned 200 and the invited user's accept returned 200 (probe in the unit harness).
- **Fix.** `src/lib/auth/index.ts`: `membershipLimit: 1` and `organizationHooks.beforeCreateInvitation` refuses with
  403 `INVITATIONS_DISABLED`, so no invitation row and no mail. Decision D-057.
- **Tests.** Unit "SEC-2"; e2e "tenant isolation and plan sharing…" (403, no invite mail in the outbox).

### SEC-3 Medium: unlimited organizations, each with fresh free limits (fixed)
- **Attack.** `organization/create` had no limit, and the switcher even offered "Create organization". Opens (5 a day)
  and saves (10) are counted per organization, so a free user could switch to a new organization whenever the limit hit:
  the paid feature for free.
- **Fix.** `organizationLimit: 1`; the switcher entry and the `/onboarding?new=1` path are removed; the onboarding copy
  no longer mentions inviting teammates.
- **Tests.** Unit "SEC-3"; e2e (second `organization/create` is 403, the list stays at one).

### SEC-5 Medium: open redirect through a tab or newline in `next` and `back` (fixed)
- **Attack.** `safeNext` (`src/components/app/redirect.ts`) and the `back` checks in `/problem`, `problemRedirect` and
  `/api/saved` refused `//host` and backslashes, but not control characters. Browsers drop tabs and newlines inside
  URLs, so `/onboarding?next=%2F%09%2Fevil.example` sent a signed-in person to `//evil.example`, and the "Go back" link
  on `/problem?back=%2F%09%2Fevil.example` pointed there too. With our domain in the link, that is a good phishing
  start.
- **Proof.** On an unfixed production build, Chromium left `localhost` and tried to resolve the attacker's host.
- **Fix.** One helper, `isSafePath` in `src/lib/security/safe-url.ts`: must start with a single `/`, no control
  characters, no backslash, and must resolve to our own origin. All four places use it.
- **Tests.** Unit "SEC-5"; e2e "redirect targets with a tab or newline stay on this site".

### SEC-7 Medium: crawler SSRF through DNS, and unbounded response bodies (fixed)
- **Attack.** The egress guard only looked at the URL text. A hostile board (or a sitemap entry, or a redirect hop)
  could name a host that resolves to `169.254.169.254`, `10.x`, `127.0.0.1` and so on, and the function would connect.
  The transport also read the whole body into memory before cutting it to 8 MB, so a multi-gigabyte answer could
  exhaust the function's memory within the 8 s timeout.
- **Fix.** `src/lib/jobs/transport.ts`: `assertPublicHost` resolves the host (all answers) and refuses private,
  loopback, link-local, CGNAT, benchmark, multicast and reserved addresses before connecting. `readCapped` streams and
  stops at 8 MB. `isPrivateIPv4` gained `192.0.0/24`, `198.18/15` and `224+`.
- **Residual.** A DNS rebinding race between our lookup and `fetch`'s own lookup is still possible. Closing it needs a
  pinned-address agent, which the platform `fetch` does not expose without a new library. Vercel functions have no
  cloud metadata endpoint, so the impact is low today. Re-check this when the crawler moves to the VPS.
- **Tests.** Unit "SEC-7" (private answers refused before any `fetch`; a 640 MB stream is cut at the cap after a few chunks).

### SEC-8 Medium (configuration): the E2E outbox would leak every sign-in link if its flag reached a deployment (fixed)
- **Attack.** `/api/dev/outbox` returns recent mail, including magic links, to anyone, gated only by
  `E2E_OUTBOX=1`. One wrong env var on Vercel would mean account takeover for anyone who signs in.
- **Fix.** `devRoutesEnabled()` (`src/lib/env.ts`) also requires that neither `VERCEL` nor `VERCEL_ENV` is set. Both dev
  routes use it.
- **Tests.** Unit "SEC-8".

### SEC-4 Low: tests ran with Better Auth's callbackURL check turned off (fixed)
- **What.** Better Auth skips its origin and callbackURL checks when `NODE_ENV=test`. Under Vitest, a magic link with
  `callbackURL=https://evil.example` was sent, and a real link with its callbackURL swapped redirected off-site. Production
  (`NODE_ENV=production`) was not affected, but the unit suite could not catch a regression.
- **Fix.** `advanced.disableOriginCheck: false` pinned in every environment.
- **Tests.** Unit "SEC-4" (absolute, `//`, `/\` and look-alike host callbacks refused for `callbackURL`,
  `errorCallbackURL` and `newUserCallbackURL`; tampered link not followed). e2e "sign-in refuses callback URLs on other sites".

### SEC-6 Low: crawled apply links were not checked for scheme at ingest (fixed, defence in depth)
- **What.** `buildJob` only required a host, so `javascript://example.com/%0Aalert(1)` from a board would be stored.
  It was **not exploitable**: `/api/jobs/[id]/open` only hands out links that start with `http://` or `https://`, and
  nothing else renders the apply link. But `script-src` allows `'unsafe-inline'`, so a stored `javascript:` link would
  run if a later change rendered it.
- **Fix.** `buildJob` drops drafts whose apply link is not http(s).
- **Tests.** Unit "SEC-6".

## Attacks tried that did not work (kept as regression tests)

- **Tenant isolation on Better Auth.** User B against A's organization id: `get-full-organization`, `set-active`,
  `update`, `delete`, `list-invitations`, `api-key/create`, `api-key/list` are all refused (unit + e2e). App routes
  (saved, export, alerts, manage links, profile, opens) were already covered by `tests/unit/battle.test.ts`.
- **Privilege escalation to founder.** `ADMIN_EMAILS` keys on the e-mail. `update-user` cannot change it and
  `change-email` is disabled (unit). `/admin` and `/api/admin/*` answer 404 to a normal account (e2e).
- **Magic link replay.** A used link answers `error=INVALID_TOKEN` and sets no session (unit).
- **Session replay after sign-out.** The old `session_token` cookie gets `null` from `get-session` and a redirect from
  `/api/saved/export` (e2e). Cookies are HttpOnly and SameSite=Lax; in production they are `__Host-` and Secure
  (`cookieConfig`).
- **NoSQL operators.** `{"jobId":{"$ne":""}}` to `/api/saved` and `{"$ne":1}` as a job id answer 4xx without internals
  (zod types every body; job ids are path strings). The only `RegExp` built from input escapes it.
- **Errors and health.** No stack traces, paths or driver names in bad-JSON answers, operator payloads or `/api/health` (e2e).
- **Billing tampering.** Checkout takes only a plan name from an enum; prices and lookup keys come from
  `product.ts`; Plus is refused while `onSale: false`; webhooks verify the raw-body signature and drop duplicates
  (earlier reviews, still green).
- **Header and HTML injection in mail.** Every template value goes through `esc`; mail is sent as JSON to Resend (no raw
  headers); the only template with a sender-controlled string (invite) can no longer be triggered.
- **CSV injection.** `csvCell` prefixes formula characters (battle tests).
- **Dependencies.** `npm audit fix` raised the `typescript-eslint` packages from 8.72.1 to 8.72.2 (patch only, in
  the lockfile). 8 moderate advisories remain, all in dev-only lint tooling (`minimatch` under `eslint-config-next`).
  The only fix offered is a major downgrade of `eslint-config-next`, so they stay. Nothing in the runtime bundle is
  affected.
- **Secrets in the build.** `tests/unit/csp-audit.test.ts` greps the built output; there are no source maps in
  `.next/static`; the only `NEXT_PUBLIC_` variable is the app URL.

## Open: needs a product decision

1. **ALTCHA is not checked anywhere (Medium).** `/api/altcha` hands out challenges and `verifyAltcha` works (unit
   test), but no form solves one and no route verifies one. The brief lists ALTCHA as P0 against sign-up floods. What
   limits mail bombing today: Better Auth's per-IP rule (15 magic links per 10 min), the per-inbox cap (5 per 10 min,
   silent), disposable-domain blocking and the 254-character limit. A botnet with many IPs could still send up to 720
   links a day to one inbox and many links across inboxes, which costs mail reputation.
   *Recommendation:* solve an invisible proof-of-work challenge in the sign-in form, send it as a header, and verify it in
   a Better Auth `hooks.before` on `/sign-in/magic-link`. With the current cost (PBKDF2, 5,000 rounds) a solve can take
   several seconds on a mid-range phone, so the founder should choose the cost against sign-in speed. The e2e and unit
   sign-in helpers would need to solve too. Not done here because it changes the sign-in experience while the sign-in
   delivery bug is still open (PROGRESS, 10 Nov).
2. **`script-src 'unsafe-inline'` (Low).** Needed by Next's inline bootstrap without nonces. Moving to per-request
   nonces makes every page dynamic. Revisit once the pages are known to be dynamic anyway; until then, every
   user- and crawl-supplied string is rendered through React (escaped) or JSON-LD with `<` escaped.
3. **Client IP from `x-forwarded-for` (Low).** On Vercel the platform overwrites the header, so it cannot be spoofed.
   Behind another proxy (the planned VPS) the first hop is client-controlled: set the proxy to overwrite it, or switch
   `clientIp` to the proxy's trusted header when moving.
4. **API-key plugin still mounted (Low).** Keys can be created for your own organization only (tested); no route
   accepts them. Removing the plugin changes the auth schema, so it stays until a migration window.
5. **Session cookie cache (Low, accepted in D-056).** A stolen `session_data` cookie keeps working for up to 60 s after
   sign-out or suspension.
6. **Free limits through new e-mail addresses (accepted).** Plus-addressing gives a new account with new free limits.
   That is inherent to a free tier with magic-link sign-up. Watch the opens-per-account ratio after launch.

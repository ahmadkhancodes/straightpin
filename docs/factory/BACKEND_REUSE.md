# Backend reuse map: Trayo + Jotflow -> Next.js SaaS starter

Sources (read-only): `/home/user/trayo` (the richer, reference backend) and `/home/user/jotflow`. Paths below are relative to each repo root. Both servers are framework-free: one `handle(req: Request, env): Promise<Response>` plus a `Db` interface, so almost everything ports by moving logic, not rewriting it.

**Rule of thumb:** copy from Trayo `server/`. Jotflow's `server/` is a smaller, slightly tidier subset (no Stripe, no email, no anonymous users) and only contributes three improvements (section 2.1). Jotflow's own CLAUDE.md says it copied nothing from Trayo and wrote its server from BACKEND_PORTABILITY.md, so the two have diverged in field naming (Trayo snake_case rows, Jotflow camelCase). Pick Trayo's.

## 0. What the web SaaS does NOT need

Do not port: anonymous users (`POST /auth/anonymous`, `mergeUser`, `anon` JWT claim), offline sync (`/sync/push|pull`, `SYNC_TABLES`, `upsertRows/pullSince/softDelete`), photo storage (`server/storage/*`, `/photos/:id`), family plan (`server/family.ts`, `/family/*`), `PAYMENTS_PROVIDER=play`, RevenueCat/Play Billing (`src/services/purchases/*`), ephemeral keys + PaymentSheet/PlatformPay flows, push tokens/notifications, `@react-native-google-signin`, MMKV, PostHog-RN, Sentry-RN, widgets, anything under `app/`, `modules/`, `plugins/`, `e2e/`. Web checkout uses Stripe Checkout (hosted) or Payment Element instead of PaymentIntent+ephemeral key.

## 1. Inventory, what each piece does, and how to port it

### 1.1 Google sign-in (token verification)
- Trayo `server/lib/jwt.ts` (`verifyGoogleIdToken`, JWKS cache 1 h, RS256 via WebCrypto, checks iss/aud/exp/sub) and Jotflow `server/src/google.ts` (same, key fetch injected as `KeyFetcher`, which is better for tests).
- Quality notes: no JWT library, runs on Node/Edge. Trayo does NOT reject `email_verified=false`; Jotflow does (`!profile.emailVerified -> 401`). **Keep Jotflow's check.** Jotflow lowercases the email; keep that.
- Web port: mobile sends an ID token from the native SDK. On web use Google Identity Services (GIS "Sign in with Google" button, returns `credential` = ID token) posted to `POST /api/auth/google`, verified by this exact function with `aud = GOOGLE_CLIENT_ID`. This avoids a full OAuth redirect flow and needs no client secret. If you prefer redirect/code flow, add `auth-code` exchange and still verify the returned `id_token` with the same function. Authorised JavaScript origins must list every app domain (see section 4: one shared client, many origins).

### 1.2 Email code sign-in (6-digit code)
- Trayo `server/handler.ts` routes `/auth/email/start|verify`, helpers `normEmail`, `sixDigits`; Db methods `saveEmailCode/getEmailCode/incEmailCodeAttempts/deleteEmailCode` (`server/db/Db.ts`, `server/db/mongo.ts`); email interface `server/email/{Email,index}.ts` (Resend via plain `fetch`, `log` provider for tests/dev).
- Behaviour: code hashed `sha256(email:code)`, TTL 10 min, 60 s resend cooldown (429), max 5 attempts (429), single-use, upgrades/links accounts by email. Not built in Jotflow (`/auth/email` returns 501).
- Gaps to fix when porting: (a) `email_codes` has no TTL index, add one on a **Date** field; (b) attempts increment is read-then-write, use one atomic `findOneAndUpdate({$inc})` before comparing; (c) compare hashes with a constant-time check; (d) no per-IP limit (see 1.9); (e) sent text is hard-coded "Trayo", make it `APP_NAME`/`APP_DISPLAY_NAME`; (f) magic link: send `https://app/api/auth/email/callback?token=...` carrying a second random token (store only `sha256`), same table, same TTL. Offer both code and link in one email.
- Port: `src/lib/auth/emailCode.ts` + `src/lib/email/*`; routes `POST /api/auth/email/start`, `POST /api/auth/email/verify` set the session cookie (1.3). `EMAIL_PROVIDER=log` keeps tests offline.

### 1.3 JWT / session issuance and refresh
- Trayo `server/lib/jwt.ts` (`signJwt`/`verifyJwt`, HS256 WebCrypto, claims `{sub, app, anon, iat, exp}`), `server/lib/ids.ts` (`uuidv7`, `randomToken`, `sha256`, `b64url`), `issueTokens`/`authUser`/`/auth/refresh` in `server/handler.ts`. Jotflow `server/src/jwt.ts`, `crypto.ts`, `issueSession` (adds `deviceId` to refresh record; access TTL 15 min, refresh 60 d; Trayo 1 h / 90 d).
- Quality notes: refresh tokens are random, stored hashed, single-use, rotated every refresh (`findOneAndDelete`), JWT `app` claim is checked against `APP_NAME` so one app's token never works in another. `JWT_SECRET` must be >= 32 chars.
- **Biggest web change:** mobile keeps bearer tokens in secure storage; web must not put tokens in JS-readable storage. Port as: access JWT (15 min) in an httpOnly, Secure, SameSite=Lax cookie `__Host-<app>_at` (path `/`), refresh token in a second httpOnly cookie `__Host-<app>_rt` scoped to `/api/auth` only. Keep Bearer support in `authUser` for future mobile/API clients. A `getSession()` helper reads `cookies()` (server components, server actions, route handlers) and verifies with `verifyJwt`; `middleware.ts` only does a cheap presence/expiry check (Edge runtime has WebCrypto, so full verify also works there, but do not hit Mongo in middleware). Sign-out = delete cookies + delete refresh row.
- Cookie CSRF: SameSite=Lax plus requiring `Content-Type: application/json` and an `Origin` check on all non-GET route handlers; server actions already get Next's origin check. Stripe webhook is exempt (signature).
- Use a distinct `JWT_SECRET` per app (prevents cross-app token reuse even though `app` claim is checked).

### 1.4 User model
- Trayo `server/db/Db.ts` `User {id uuidv7, app, anonymous, googleSub, email, stripeCustomerId, createdAt}`; Jotflow adds `lastSeenAt, country, locale`. Mongo: `users` with `_id = id`, indexes on `{app, googleSub}`, `{app, stripeCustomerId}`, `{app, email}` (all sparse) in `ensureIndexes` (`server/db/mongo.ts`).
- Port: drop `anonymous`; add `name`, `image`, `role`, `deletedAt`, `analyticsConsent`. Make the `{app,email}` and `{app,googleSub}` indexes **unique** (Jotflow does; Trayo's are only sparse). Since each SaaS gets its own Atlas database or at least `app` field, keep the `app` field anyway so a shared cluster stays safe.

### 1.5 MongoDB connection / driver layer
- Trayo `server/db/{Db,index,mongo,memory,postgres}.ts`, `server/env.ts` (`DB_DRIVER=mongo|postgres|memory`, `MONGODB_URI`, `MONGODB_DB`). `dbFromEnv(env)` picks the driver; `memory.ts` is used in all tests; `server/__tests__/dbContract.ts` is a shared contract suite run against every driver. Jotflow `server/db/{Db,index,mongo,memory}.ts` loads the driver lazily.
- Quality notes: `maxPoolSize: 1` + module-level cached `MongoClient` is right for Workers; every document carries `app`; idempotency via `_id` duplicate-key (11000) in `recordStripeEvent`.
- Port: `src/lib/db/{index,mongo,memory,types}.ts`. Keep the interface, delete sync/family methods. Replace the module-level `cached` with the Vercel-recommended global singleton (`globalThis._mongo`) and raise `maxPoolSize` to ~5-10; on Vercel Fluid compute consider `attachDatabasePool` from `@vercel/functions`. Atlas network access: Vercel egress IPs are not fixed, so allow `0.0.0.0/0` on M0 (strong password, TLS) or use Atlas-Vercel integration. Force `export const runtime = 'nodejs'` on every route using Mongo (driver does not run on Edge). Keep memory driver for tests; drop Postgres stub unless needed.
- **Bug to fix on port:** `refresh_tokens` has `createIndex({expiresAt:1},{expireAfterSeconds:0})` but `expiresAt` is stored as epoch-ms **number**; Mongo TTL only expires BSON Date fields, so rows never expire (verified in both repos' `mongo.ts`). Store `expiresAt` as `Date` (or add a separate `expireAt: Date`). Same for new email-code and stripe_events TTLs.
- Index creation: Trayo runs it from `ensureIndexes` via `npm run server:indexes` (manual); Jotflow lazily creates on first request. For Vercel, use a one-off script `scripts/ensure-indexes.ts` run in CI/postbuild; do not create indexes per cold start.

### 1.6 Stripe (checkout, portal, webhook, entitlements)
- Trayo `server/billing.ts` (all of it), webhook + routes in `server/handler.ts` (`/billing/prices|create-subscription|create-payment|portal|entitlement|webhook`), tests in `server/__tests__/{handler,billingVersions}.test.ts` + `fakes.ts` (`fakeStripe`), catalogue seeding `scripts/stripe-setup.ts` (idempotent, matches by `metadata.app` + `lookup_key`, plain `fetch`, no SDK), docs `docs/STRIPE.md`. Jotflow has NO Stripe implementation (billing routes 404/501 while `PAYMENTS_ENABLED=false`).
- Key logic to keep verbatim:
  - **App isolation (C-28):** every Customer/Subscription/PaymentIntent has `metadata.app`; only prices whose `lookup_key` starts with `<app>_` and `metadata.app === app` are accepted; lookup keys `<app>_pro_monthly|annual|lifetime`. The owner uses ONE Stripe account (BufferSol Technologies) for all apps, so this is mandatory.
  - **Source of truth = Stripe, recompute not patch:** `computeEntitlement` lists the customer's subscriptions and picks the best (live beats dead, later `expiresAt` wins). Order-independent, so duplicate/out-of-order webhooks converge (C-25). `entitlement?refresh=1` runs the same recompute so Pro unlocks right after checkout without waiting for the webhook (C-13).
  - **Per-customer single trial:** `trial_period_days` is set server-side, skipped if `customer.metadata.trial_used`, stored entitlement `trialUsed`, or any past sub with `trial_start` (C-19). Also blocks a second live sub (409 `already_subscribed`). Web: also pass `payment_method_collection: 'if_required'` decisions deliberately; Trayo uses `trial_settings.end_behavior.missing_payment_method: 'cancel'`.
  - **Past due = grace:** `past_due` stays Pro; `canceled/unpaid/incomplete_expired` ends it (C-20).
  - **Refund -> Pro off (C-27):** `charge.refunded` with `refunded === true` (full refund only): lifetime entitlement matching `lifetimePaymentIntentId` is replaced by `NONE` (keeps `trialUsed`); otherwise `cancelAppSubscriptions` cancels every live sub of this app, then the entitlement is recomputed. Partial refunds are ignored.
  - **API version 2022-11-15 handling (D41):** the Stripe webhook endpoints are pinned to 2022-11-15 while the SDK is newer. `periodEndOf` reads `items.data[0].current_period_end` then top-level `current_period_end`; `invoiceSubscriptionId` reads `invoice.parent.subscription_details.subscription` then `invoice.subscription`; an `invoice.*` event with no `customer` resolves the customer through `stripe.subscriptions.retrieve`. Unit-tested with a 2022-11-15 fixture (`billingVersions.test.ts`, "API version 2022-11-15 payloads" block in `handler.test.ts`). Port unchanged; keep the SDK `apiVersion` default and never rely on fields only present in one shape.
  - **Webhook hygiene:** signature check on the **raw** body (`await req.text()`), 400 and write nothing on bad signature (C-26), `recordStripeEvent(event.id)` insert-first idempotency, ignore customers that do not map to this app's user (`user.app !== app`), and unknown events return 200.
  - Lifetime purchase: `payment_intent.succeeded` with `metadata.plan==='lifetime'` -> `lifetimeEntitlement`, never overwritten by subscription recompute.
- Port changes: Stripe client `new Stripe(key, {httpClient: Stripe.createFetchHttpClient()})` can stay, or drop the fetch client on Node runtime. Webhook route `src/app/api/stripe/webhook/route.ts` (`runtime='nodejs'`, `dynamic='force-dynamic'`), use `await req.text()` (do NOT `req.json()`); `constructEventAsync` is fine on Node. Replace PaymentIntent/ephemeral-key flows with **Checkout Session** (`mode:'subscription'`, `subscription_data.trial_period_days`, `subscription_data.metadata={app,plan,user_id}`, `client_reference_id=user.id`, `customer=ensureCustomer`, success/cancel URLs) and keep `billingPortal.sessions.create` (the portal endpoint is near-identical; replace the `${app}://` default return URL with the web URL). Add `checkout.session.completed` to the relevant webhook events, though recompute on `customer.subscription.*`/`invoice.*` already covers it. Extend `plansFor` to return Checkout-ready prices (currency_options logic is reusable). Do not copy `ephemeralKeys`, `pending_setup_intent`, `confirmation_secret` code.
- Pinned catalogue shape: `docs/STRIPE.md` (product `<App> · Pro`, `metadata.app=<app>`, `entitlement=pro`, lookup keys, USD/GBP/CAD `currency_options`). Copy `scripts/stripe-setup.ts` and change `APP`, names, prices; run once per mode.
- Account/products note: owner rule is to never create/edit another app's Stripe objects.

### 1.7 Entitlements / plan gating
- Shape `Entitlement {isPro, status none|trialing|active|past_due|canceled|lifetime, plan, expiresAt, trialStartedAt, cancelAtPeriodEnd, provider, checkedAt, trialUsed, subscriptionId, lifetimePaymentIntentId}` in `server/db/Db.ts` (Trayo) and a simpler `{pro, plan, expiresAt, inTrial}` in Jotflow. Stored in `entitlements` collection keyed by user id. Gating on the server: `effectiveEntitlement(db,userId,now)` (in `server/family.ts`; drop the family branch) and the 402 `pro_required` check in the photo PUT route. Jotflow's rule "Pro only from the server entitlement; client never decides" is the right principle.
- Port: `src/lib/billing/entitlement.ts` + `requirePro()` helper used in route handlers/server actions. UI gating reads entitlement via a server component (never trust a client flag). Remove `provider: 'play'`. Add `expiresAt` check at read time (Jotflow does `expiresAt > now`) so a missed webhook cannot leave Pro on forever.

### 1.8 /config feature-flag endpoint
- Trayo `GET /config` = Mongo `config` collection (`{_id:'<app>:<key>', value, app}`) merged with env `APP_FLAGS` JSON (string values only, bad JSON ignored) (`server/env.ts` `envFlags`, `db.getConfig`). Client side in `src/lib/flags.ts`: `flag_<name>=on|off`, `payments_enabled`, `payments_provider`; production defaults off, preview/dev on. Jotflow's `/config` is static (`paymentsEnabled`, `authEnabled`, `minAppVersion`).
- Port: `src/app/api/config/route.ts` with `Cache-Control: s-maxage=60, stale-while-revalidate`. Keep `APP_FLAGS`. Useful flags for SaaS: `payments_enabled` (ship free first, switch on later with no deploy), `signups_enabled`, `maintenance`. Do not expose secrets or per-user data. Mobile-only flags (`widget_*`, `dark_mode` restart logic, `payments_provider=play`) are irrelevant. Option: Vercel Edge Config instead of the Mongo collection for flags.

### 1.9 Rate limiting
- **There is no general rate limiter in either repo.** Only auth abuse guards exist: email code resend 60 s (429), 5 verify attempts, body size cap (Jotflow `MAX_BODY=1_000_000`), push batch caps (500/200 rows), photo 5 MB. Cloudflare provided edge DDoS protection implicitly.
- Port: add `src/lib/ratelimit.ts` (Upstash Ratelimit + Vercel KV/Upstash Redis, or a Mongo `rate_limits` collection with TTL Date index as a zero-dependency fallback). Apply per IP + per email on `/api/auth/*`, per user on checkout/portal/delete/export. Use `x-forwarded-for`. Optionally enable Vercel Firewall rate-limit rules. This is new code, not a port.

### 1.10 Input validation and error handling
- Validation is hand-rolled: `normEmail` (regex + length 254), `asCurrency`, plan whitelist, table whitelist, regex-checked path ids, `readJson` -> `HttpError(400,'bad_json')`, size caps. Errors: `class HttpError(status, code)` + `json()` in `server/lib/http.ts`; top-level `handle()` maps `HttpError` -> `{error: code}` and anything else -> 500 `{error:'server_error'}` with `console.error` of the message only (never leaks internals; Jotflow identical, no logging at all). Error codes are stable snake_case strings (`bad_email`, `code_expired`, `too_many_attempts`, `pro_required`...), good for the UI to translate.
- Port: keep `HttpError`/`json`/`readJson` in `src/lib/http.ts`, but replace the big `route()` if-chain with per-file `route.ts` handlers wrapped by `withApi(handler)` that does the same try/catch. Replace hand-rolled checks with **zod** schemas (already in the owner's approved stack). Drop the `CORS: *` headers (web is same-origin; only add CORS to routes that truly need it). Add `cache-control: no-store` on all JSON (Jotflow does).

### 1.11 Logging / Sentry / analytics consent
- Server: only `console.error('server_error', message)`. **No Sentry on the server in either repo**; Sentry exists only in the RN app (`src/services/crash.ts`: `sendDefaultPii:false`, `scrubEvent` deletes `user`, `server_name`, request cookies/headers/body). Analytics consent is client-only (`src/services/consent.ts`: opt-in default OFF for UK/EEA/CH/CA/unknown, ON elsewhere; PostHog not even created until consent; `disableGeoip`, no identify, no replay; D44) with tests in `src/services/__tests__`.
- Port: `@sentry/nextjs` (new library, needs owner approval per CLAUDE.md rule) with the same `scrubEvent` as `beforeSend`; log structured JSON `{level, code, route, userId}` and never log emails, tokens, codes or bodies. Re-use `consent.ts` logic as a pure function (region from `Accept-Language`/`x-vercel-ip-country` instead of `Intl`) plus a cookie banner that stores `analytics=on|off`; load PostHog/GA only after consent. Keep the event-name union approach (no free text, no health/PII values).

### 1.12 Email sending
- `server/email/{Email,index}.ts`: `EmailSender.send(to, subject, text)`, Resend over `fetch`, `EMAIL_PROVIDER=resend|log|none`, `EMAIL_FROM` default is hard-coded "Trayo <no-reply@trayo.app>" (must be env-driven per app). Plain text only. Not in Jotflow.
- Port: `src/lib/email/*`. Add an HTML template option, a verified sending domain per app in Resend, and `sentLog` kept for tests. Same-domain From per app (deliverability).

### 1.13 Account deletion and data export (privacy)
- Deletion: `DELETE /account` (Trayo `server/handler.ts`; Jotflow identical minus Stripe). Order: cancel all live app subscriptions in Stripe (`cancelAppSubscriptions`) -> delete stored files by prefix -> `db.deleteUser` (users, synced rows, refresh tokens, entitlement, family). Tested: C-42 test "DELETE /account cancels the subscription and removes all data" and the Jotflow "another user never sees rows, DELETE wipes theirs" test. Public pages `web/delete-account/index.html`, `web/privacy`, `web/terms` (static, Play-required) are reusable as templates (replace brand/text).
- **Data export does not exist on the server in either repo** (Trayo/Jotflow only export locally on device: PDF/share). For web add `GET /api/account/export` returning JSON of the user's rows (user, entitlement, app data), rate limited and re-auth gated. Also consider: leave the Stripe customer for tax/accounting records (cancel subs, optionally `customers.del` only if no invoices), add `deletedAt` soft-delete grace period if desired, clear cookies, and delete the email-code row. Add a stripe customer `metadata.user_id` scrub.

### 1.14 Photo/object storage (optional)
- `server/storage/{Storage,r2,memory,index}.ts`: `put/get/delete/deletePrefix` interface. Only port if a SaaS stores user files; swap R2 binding for Vercel Blob or S3.

## 2. Quality notes, bugs fixed, and improvements to apply while porting

### 2.1 From the docs (already fixed upstream, keep the fixes)
- D21 Supabase removed; auth now our own JWT + refresh. D24 no JWT library (WebCrypto). D25 lifetime uses `automatic_payment_methods`; subscriptions pass explicit `payment_method_types`. D41 Stripe 2022-11-15 payload tolerance (periodEnd + invoice-subscription fallbacks, `invoice` without `customer`). D45 `payments_enabled` kill-switch via `/config` + `APP_FLAGS`. C-13/19/20/25/26/27/28/41/42 are the test ids the billing tests cover.
- Jotflow improvements over Trayo worth taking: (1) `email_verified` enforced on Google tokens; (2) unique indexes on email/googleSub; (3) injectable `KeyFetcher` for Google keys and `body()` size cap `MAX_BODY`; (4) `Cache-Control: no-store`; (5) generic 500 with no logging of internals.

### 2.2 Bugs/gaps I found while reading (not documented upstream, verify then fix in the starter)
1. Mongo TTL on numeric `expiresAt` never fires (section 1.5).
2. Trayo accepts unverified Google emails (1.1).
3. `JWT_SECRET` shared design and no key rotation (`kid`) support; add a `JWT_SECRET_PREVIOUS` fallback if rotation is wanted.
4. Webhook does one Stripe API list per event (`computeEntitlement`), fine at this scale; webhook retries are safe because of recompute. If `recordStripeEvent` succeeds and the later recompute throws, the event is marked seen and Stripe will not redo the work (the 500 retries get "duplicate"). On port, record the event id **after** successful processing, or store status and allow reprocess on `failed`.
5. `Access-Control-Allow-Origin: *` on everything (fine for bearer mobile API, wrong for cookie web).
6. `createSubscription` default `return_url` uses a custom scheme (`trayo://`), irrelevant for web.
7. Trayo `GET /billing/prices` is unauthenticated and hits Stripe on each call: cache per app for 60 s.

## 3. Recommended folder layout for the universal SaaS starter

```
src/
  app/
    api/
      auth/google/route.ts            <- trayo server/handler.ts '/auth/google' (+ jotflow emailVerified)
      auth/email/start/route.ts       <- '/auth/email/start'
      auth/email/verify/route.ts      <- '/auth/email/verify' (+ magic-link GET callback)
      auth/refresh/route.ts           <- '/auth/refresh'
      auth/logout/route.ts            <- new (delete cookies + refresh row)
      billing/prices/route.ts         <- '/billing/prices'
      billing/checkout/route.ts       <- adapted from create-subscription / create-payment
      billing/portal/route.ts         <- '/billing/portal'
      billing/entitlement/route.ts    <- '/billing/entitlement' (?refresh=1)
      stripe/webhook/route.ts         <- webhook() in handler.ts
      config/route.ts                 <- '/config'
      health/route.ts                 <- '/health'
      account/route.ts                <- DELETE /account
      account/export/route.ts         <- new (GET)
  lib/
    http.ts            <- trayo server/lib/http.ts (HttpError, json, readJson) + withApi()
    env.ts             <- trayo server/env.ts (typed process.env via zod, appName, envFlags)
    ids.ts             <- trayo server/lib/ids.ts (uuidv7, randomToken, b64url, sha256)
    auth/jwt.ts        <- trayo server/lib/jwt.ts (signJwt, verifyJwt)
    auth/google.ts     <- verifyGoogleIdToken (jotflow server/src/google.ts shape + trayo cache)
    auth/session.ts    <- new: cookies, getSession(), requireUser(), issueTokens()
    auth/emailCode.ts  <- handler.ts email helpers
    db/types.ts        <- trayo server/db/Db.ts (users, entitlements, refresh/email codes, stripe events, config only)
    db/index.ts        <- trayo server/db/index.ts (dbFromEnv)
    db/mongo.ts        <- trayo server/db/mongo.ts (remove sync/family/mergeUser; global singleton client)
    db/memory.ts       <- trayo server/db/memory.ts
    billing/stripe.ts  <- client factory from handler.ts depsFromEnv
    billing/catalog.ts <- trayo server/billing.ts (lookupKeys, appPrices, plansFor, amountFor)
    billing/entitlement.ts <- computeEntitlement, periodEndOf, invoiceSubscriptionId, NONE, lifetimeEntitlement, cancelAppSubscriptions, requirePro
    billing/webhook.ts <- webhook() body from handler.ts
    email/{Email,index}.ts <- trayo server/email/*
    flags.ts           <- trayo src/lib/flags.ts resolve* (pure part) + envFlags
    consent.ts         <- trayo src/services/consent.ts (pure functions, no MMKV)
    ratelimit.ts       <- new
    sentry.ts          <- scrubEvent from trayo src/services/crash.ts
  middleware.ts        <- cookie presence + route protection
scripts/
  stripe-setup.ts      <- trayo scripts/stripe-setup.ts (edit APP + catalogue)
  ensure-indexes.ts    <- trayo server/db/mongo.ts ensureIndexes (trimmed, Date TTLs)
__tests__/ (or src/**/__tests__)  <- see section 5
```
Optional extractions: since the first SaaS will be copied for every later one, keep `src/lib/{http,env,ids,auth,db,billing,email,flags,consent,ratelimit}` free of app-specific strings so the template repo can be cloned and only `APP_NAME`, price keys and copy change. A shared npm package is not needed yet.

## 4. Environment variables (names only)

Shared across all SaaS apps (same value everywhere):
- `GOOGLE_CLIENT_ID` (ported from `GOOGLE_WEB_CLIENT_ID`; one OAuth Web client with every app origin added as an authorised origin, and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` for the GIS button)
- `STRIPE_SECRET_KEY` (one account; use restricted keys if desired), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (only if Payment Element is used)
- `RESEND_API_KEY` (one Resend account; each app needs its own verified domain)
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` (if Sentry is adopted)
- `MONGODB_URI` can be shared if all apps use one Atlas cluster with a database per app (recommended on M0, which allows only one free cluster); use a distinct DB user per app if possible.

Per app:
- `APP_NAME` (slug; also prefix for Stripe lookup keys and the `app` field), `APP_DISPLAY_NAME`, `NEXT_PUBLIC_APP_URL`
- `MONGODB_DB` (database name = app), `DB_DRIVER` (`mongo|memory`)
- `JWT_SECRET` (>= 32 chars, unique per app)
- `STRIPE_WEBHOOK_SECRET` (one webhook endpoint per app deployment URL, so a different `whsec_` per app even on the same Stripe account)
- `EMAIL_PROVIDER`, `EMAIL_FROM` (per-app verified domain)
- `APP_FLAGS` (JSON of remote flags)
- `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN`, `SENTRY_PROJECT`, `NEXT_PUBLIC_POSTHOG_KEY` (per-app projects)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (rate limiting; can be shared with key prefixes)
- `STORAGE_DRIVER`/`BLOB_READ_WRITE_TOKEN` (only if files are stored)

Dropped (mobile only): `EXPO_PUBLIC_*`, `EAS_*`, `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, `PAYMENTS_PROVIDER`, `PAYMENTS_ENABLED` (use the flag `payments_enabled` in `APP_FLAGS`/config instead).
Never copy real values from either repo's `.env`/`wrangler.toml` secrets; set them in Vercel project env per environment (Production/Preview/Development).

## 5. Tests to port

Test harness: Trayo runs server tests in Jest project `server` (`jest.config.js`, `testEnvironment: 'node'`) against the memory DB and `fakeStripe`; Jotflow uses a plain Node-style `handler.test.ts` with a real RSA-signed Google token. For Next.js use Vitest or Jest with `ts-jest`/SWC; test the library functions and call route handlers directly with `new Request(...)`.

Port (adapt imports and drop anonymous/family/sync cases):
- `trayo/server/__tests__/fakes.ts`: `ENV`, `fakeStripe`, Google token helpers (b64url signing). Reuse as test fixtures.
- `trayo/server/__tests__/dbContract.ts` + `memoryDb.test.ts`: contract suite for users, entitlements/webhook idempotency, refresh rotation, email codes, delete-user. Keep those, drop sync/merge/family. Run the same contract against Mongo in CI with a throwaway DB (mongodb-memory-server or an Atlas test DB).
- `trayo/server/__tests__/handler.test.ts`: auth (forged tokens, refresh rotation, Google audience/expiry), billing (prices by lookup key and currency, trial once, no duplicate sub, foreign-app price rejected, lifetime + portal, `refresh=1`), webhook (bad signature, trial->paid, past_due grace, duplicate/out-of-order, full refund -> Pro off, 2022-11-15 payloads, other app's customers ignored), account delete cancels subs, health/config/APP_FLAGS. Skip sync/photo/family blocks.
- `trayo/server/__tests__/billingVersions.test.ts`: `periodEndOf`/`invoiceSubscriptionId` shape tolerance (copy as is).
- `trayo/server/__tests__/emailAuth.test.ts`: code send/verify, attempts lock at 5, 60 s resend, 10 min expiry, bad email, 503 with no provider (drop the anonymous-merge assertions; add atomic-attempts and magic-link tests).
- `jotflow/server/test/handler.test.ts`: JWT round trip/tamper/expiry, Google token negative cases (wrong audience, expired, bad signature, and **add unverified email**), 503 without `JWT_SECRET`, 401 without token, per-user isolation, `DELETE /account` wipes data.
- `trayo/src/services/__tests__` consent test (regional default opt-in/out, `regionOf`), and the `scrubEvent` test if present; port as pure unit tests.
- Do not port: widget, notification, purchases (RevenueCat/Play), design-token/lightness/copy-policy, store-asset size tests, Maestro `e2e/`, family and photo tests.
- New tests required: cookie session (set/clear, SameSite/HttpOnly flags, CSRF origin check), rate limiter, Mongo TTL Date fields, webhook processed-after-success retry behaviour, `GET /account/export`.

## 6. Suggested port order (single pass)
1. `lib/{http,env,ids}` + `auth/{jwt,google}` + tests. 2. `db/{types,memory,mongo,index}` + contract test. 3. Session cookies + `/api/auth/*` (Google, email code/link, refresh, logout). 4. `billing/*` + Stripe routes + webhook + tests + `scripts/stripe-setup.ts`. 5. `/api/config`, `/api/account` (delete + export), rate limiter, Sentry/consent. 6. Static `privacy`, `terms`, `delete-account` pages adapted from `trayo/web/*`.

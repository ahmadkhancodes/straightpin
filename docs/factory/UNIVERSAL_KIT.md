# Universal SaaS kit v1 (built in `ahmadkhancodes/postslot`, tag `kit-v1`)

Purpose: everything every BufferSol SaaS needs, built once, copied into each new repo (no shared package, no runtime dependency).
It must contain **no product-specific design**. Visuals come from tokens each product sets from its own `docs/DESIGN.md`.

## Stack
Next.js (App Router, latest stable) · TypeScript strict · Tailwind CSS v4 (CSS-variable tokens) · ESLint · Vitest · Playwright · MongoDB driver · Better Auth · Stripe · Zod.

## Modules (port from `docs/BACKEND_REUSE.md` sources where marked)
1. **Config:** `src/config/product.ts` holds the single source for name, host, plans, limits, feature flags and copy constants. `/api/config` serves flags (ported).
2. **DB:**
   - Mongo + memory drivers behind one interface (ported from Trayo `server/db/`), with the contract test.
   - TTL fields are `Date`, not numbers. That was a known bug in the apps.
3. **Auth:** Better Auth with magic link, passkeys, TOTP, orgs + roles (owner/admin/member/viewer), API keys (hashed, prefix shown) and sessions in httpOnly `__Host-` cookies. It also needs an Origin/CSRF check, account deletion and data export.
4. **Billing:**
   - Stripe Checkout, the Customer Portal and the webhook (ported).
   - Rules carried over from the apps:
     - Isolate each app via `metadata.app` and `lookup_key` prefix.
     - Recompute entitlements from Stripe on every webhook.
     - One trial per customer.
     - A full refund turns Pro off.
     - Handle both webhook payload shapes.
     - Record the event only after processing succeeds (the apps recorded it before, so failures were never retried).
   - Plan and limit enforcement helpers, metering hooks (MAU, mailboxes, devices, submissions), usage banners, and grace periods.
   - `scripts/stripe-setup.ts` creates the products and prices from `product.ts`.
5. **Mail:**
   - A `Mailer` interface with a provider adapter, a console adapter for dev, and an SMTP adapter stub for the VPS.
   - React-email templates, a suppression list, and an RFC 8058 one-click unsubscribe.
6. **Abuse and security:**
   - A Mongo sliding-window rate limiter.
   - ALTCHA (self-hosted proof-of-work) on public forms, plus a disposable-domain blocklist.
   - Zod validation everywhere, security headers/CSP, and an audit log (append-only).
7. **Outbound webhooks:** HMAC-SHA256 signing, retries with backoff, a delivery log UI. Used by Wirebook, Hotrail, Inboxwire, Postslot, DockCrate.
8. **Cron:** `/api/cron/[job]` guarded by `CRON_SECRET`, plus a Cloudflare Worker cron template (`infra/cron-worker/`) for per-minute schedules.
9. **App shell:**
   - Dashboard layout, org switcher, settings (profile, security, members, API keys, billing, webhooks, audit log), and founder admin.
   - Empty, loading and error states as components.
10. **Marketing system:**
    - Section components for hero (with real product UI slot), problem, how-it-works, features, compare table, pricing table (from config), FAQ, final CTA and footer ("A BufferSol product").
    - Docs (MDX) + `llms.txt`, compare-page template, legal pages (privacy, terms, DPA, security, sub-processors), 404, sitemap, robots, per-page metadata, generated OG images, favicons.
    - All of it follows `design-kit/DESIGN_PLAYBOOK.md` rules and has **no default palette**: the product sets tokens.
11. **Ops:** `/api/health`, structured logger, error boundary, Vercel Web Analytics.
12. **QA and deploy:**
    - `scripts/screenshots.ts` (Playwright 375/1440, light/dark, every route) and Lighthouse CI.
    - The design scorecard from the design kit.
    - `scripts/deploy.sh` (CLI deploy to the SaaS Vercel account, then `scripts/vercel-keep-latest-3.sh`).
    - GitHub Actions CI (lint, typecheck, test, build).
13. **Repo memory:** `CLAUDE.md` template, `docs/PROGRESS.md`, `docs/DECISIONS.md`, `docs/DESIGN.md`, `docs/ROADMAP.md`. `.claude/skills/landing-page-design/` is installed.
14. **Copy procedure:** `KIT_COPY.md` explains how a new repo takes the kit:
    - Copy at tag `kit-v1`.
    - Rename the product constants.
    - Create the DB user and Stripe products, set the Vercel env.
    - Run the checks.

## Done when
- Tests pass (ported tests + new ones for auth, billing, rate limit, webhooks, mailer).
- The demo deploy on the SaaS Vercel account works end to end: magic-link sign-in → org → Stripe test checkout → plan active → portal → cancel.
- Lighthouse 90+ on the kit's sample landing, and `kit-v1` is tagged.

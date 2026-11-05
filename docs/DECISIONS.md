# Decisions

Standing decisions are in docs/factory/BATCH1_PLAN.md (Mongo instead of Postgres, Better Auth, Stripe first, Mailer interface, Vercel-first, keep 3 deployments).

## Straightpin decisions (Phase 0, 5 Nov 2026)
- **D-001 Storage:** jobs store an excerpt (≤ 600 chars) plus link, not full HTML. Matches the brief's "short excerpt and link to employer", and keeps 250K jobs near 500 MB. M10 upgrade is a manual step.
- **D-002 Scheduler:** Cloudflare Worker cron calls `/api/cron/*` (CRON_SECRET); Vercel Cron only as daily backstop.
- **D-003 Design overrides of the landing-page-design skill:** two families plus mono and a margin note font, warm dark palette, no gradient on hero text, solid top bar, UI word "open" instead of "unlock". Reasons in docs/DESIGN.md section 7.
- **D-004 Classifier:** pure TypeScript inference from JSON weights (no ONNX on Vercel), same `AgencyModel` interface so ONNX can return on the VPS. Model only goes live past the precision gate; rules + review queue ship regardless.
- **D-005 Payments:** Stripe, not Paddle (owner rule). Brief's "Paddle overlay" becomes Stripe Checkout.
- **D-006 Auth:** Better Auth email code/magic link + passkeys, instead of Auth.js (kit decision).
- **D-007 Weight rule:** display uses Bricolage 600/700 (no 800) to respect the "no ultra bold" skill rule.
- **D-008 Competitor note:** DirectRoles live hero is now indigo gradient (brief recorded blue). HiringCafe is behind a bot challenge and is not crawled or bypassed.
- **D-009 Palette and mono (orchestrator review, 5 Nov 2026):** primary changed from teal #0F5C55 to pushpin tomato #B8381C (warm paper neutrals, dark mode #FF8A6B on #1A1512) so Straightpin is distinct from the other green/teal BufferSol products and friendlier for a consumer audience. Margin notes use ballpoint blue #2A4B9B so red keeps one job. Mono is now tiny metadata only (source host, first posted date); Caveat only for the "Old posting" note. All pairs checked AA.
- **D-010 Kit applied (kit-v1 @ 03398f3):** copied per KIT_COPY.md. Plans are free, weekly, monthly, lifetime, plus (plus is `comingSoon`, exists in Stripe, hidden in UI). Lookup keys per brief: straightpin_weekly, _monthly, _lifetime, _plus_monthly, _plus_annual. Kit changes: Interval now week|month|year|once; lifetime uses Stripe Checkout mode=payment with PaymentIntent metadata mode=lifetime (webhook already handled it); lifetime cap 1000 enforced by `Db.countEntitlements`; `opens_day` meter resets per UTC day; meters are opens_day, saved_jobs, followed_companies, instant_alerts.
- **D-011 Tests:** vitest also runs src/lib/crawl, src/lib/classify and ml tests.

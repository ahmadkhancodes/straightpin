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

- M1-A (5 Nov 2026), plan model: `PlanId` = free | weekly | monthly | lifetime | plus; `Interval` = week | month | year | once. Lookup keys are `straightpin_<plan>_<interval>` (straightpin_weekly_week, straightpin_monthly_month, straightpin_lifetime_once, straightpin_plus_month, straightpin_plus_year). Plan order is the rank for `requirePlan`; Lifetime ranks between Monthly and Plus (core plan, no Plus features).
- M1-A, meters: `opens` (per UTC day, Free 5) and `saves` (running total, Free 10). "Unlimited" is `UNLIMITED = 1_000_000` (Infinity does not survive JSON).
- M1-A, Lifetime checkout: Stripe Checkout `mode: "payment"` with `metadata.mode=lifetime` and `metadata.lookup_key`; the existing `payment_intent.succeeded` webhook path grants it. The 1,000 buyer cap (`product.lifetimeCap`) is not enforced yet.
- M1-A, marketing/pricing page copy still carries kit sample text (form endpoint copy, Postslot name swapped to Straightpin by search only). M1-B replaces it. The pricing table renders five cards with the kit's interval toggle until then.
- M1-A, dark mode palette stays on the kit's `[data-theme=dark]` switch (no `prefers-color-scheme` rule added).
- M1-A, fonts: Bricolage Grotesque drives `heading-1..6` via `--font-display-family`; Caveat is exposed as `font-note` for the single Old posting note. Hero heading gradient tokens are both ink (solid, per DESIGN.md §7). Added role tokens brand-tint, highlight, marker. Layout themeColor updated to the board colours.

## M1-B (5 Nov 2026)
- **M1-B sample data:** the storefront uses `src/content/sample-jobs.ts` (12 invented jobs, 8 field counts). Every place that shows it says "sample". Replace with the real job database in M2.
- **M1-B docs become Help:** `/docs` stays as the route (no redirect needed) but holds three short job seeker pages (getting started, account, billing and refunds). The kit's API, webhooks and authentication developer docs are removed.
- **M1-B legal:** DPA and acceptable use pages removed (they were for form processing); added `/legal/refunds`. Placeholders kept visible: `{{jurisdiction}}`, `{{registered address}}`, `{{liability cap}}` (MANUAL_STEPS item 8).
- **M1-B nav and header:** solid top bar with "by BufferSol", Log in always visible, primary "See my matches" from 768px; nav is Jobs (anchor to the field picker), Pricing, How we check. Jobs becomes a real page in M2.
- **M1-B pricing:** the kit interval toggle is gone. Free, Weekly, Monthly (labelled "Pre selected", ring) on the landing page plus a Lifetime line; `/pricing` adds Lifetime and Plus monthly and annual cards, all from product.ts.
- **M1-B citations:** third party statistics are cited by name and date only because the brief has no URLs; no invented links.
- **M1-B tooling:** `scripts/screenshots.ts` and `playwright.config.ts` accept `CHROMIUM_PATH` for machines without Playwright's browser download; default behaviour is unchanged.

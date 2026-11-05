# Progress: Straightpin by BufferSol

## State (5 Nov 2026)
- Phase 0 done and fully approved by the orchestrator (tomato palette, D-009).
- Pure TS modules built while waiting for kit-v1 (no UI, no network in tests, 181 tests):
  - `src/lib/crawl/net/`: robots parser + policy, per host limiter, egress deny list, `fetchPolite`.
  - `src/lib/crawl/adapters/`: Greenhouse, Lever, Ashby, Workable, Recruitee XML, Personio XML.
  - `src/lib/crawl/careers/`: JSON-LD JobPosting extractor, sitemap parser, career site crawler.
  - `src/lib/crawl/dedupe/`, `score/`: MinHash dedupe, repost/ghost signals and labels.
  - `src/lib/classify/` + `ml/agency/`: agency rules, hashed TF-IDF logistic model, training and precision gate.
- Known gaps: no labelled agency data yet (model stays off until the precision gate passes; rules + review queue ship); adapters use hand written fixtures shaped like the public APIs, not recorded live responses (verify against live boards in M2).
- Next: M2 (feeds and the job database).
- Live URL: not deployed yet.
- 5 Nov 2026 M1-A done: kit renamed to Straightpin (product.ts plans = brief prices, lookup keys `straightpin_<plan>_<interval>`, Lifetime one-time checkout), crawl/classify/ml merged (tests run in `npm test`, 228 pass), tomato/paper tokens and Bricolage/Public Sans/JetBrains Mono/Caveat fonts in, `*.product.json` removed. lint, typecheck, test, build green. Landing/pricing copy is still kit sample text (M1-B). Lifetime 1,000 buyer cap not enforced yet.
- 5 Nov 2026 M1-B code done, deploy pending: storefront built per DESIGN.md/SECTION_PLAN. `/` (notice cards, field chips with sample counts and a matches preview, price and refund on the first screen, problem, tagline reveal, how it works, bento, mini compare, pricing, FAQ), `/pricing` (all plans from product.ts), `/compare/directroles` (dated, brief facts only), `/how-we-check`, help pages (`/docs`, rewritten for job seekers), legal rewritten for Straightpin plus a refund policy, footer disclaimer, llms.txt, sitemap. Removed: demo inbox, Web3Forms compare, DPA and acceptable use pages, API keys / webhooks / members settings pages. lint, typecheck, 228 unit tests, build and 4 Playwright tests green (run with `CHROMIUM_PATH=/usr/bin/chromium` where Playwright's browser is not installed). Screenshots in `docs/qa/`, scorecard in `docs/design-qa.md` (39/50, see residuals). Not deployed.
- Still open after M1-B: counter flip animation; link the cited sources (Indeed policy, Greenhouse, ClearlyRated, Resume Builder) once the URLs are known; `/bot`, `/about/data`, `/ca`, `/uk` pages; legal placeholders (MANUAL_STEPS item 8); Lifetime 1,000 cap enforcement; the signed in app (`/app`) is still the kit shell with a placeholder matches panel; API routes for api keys, webhooks and organizations still exist behind the app (UI removed).
- Next: M2: feeds and the job database.

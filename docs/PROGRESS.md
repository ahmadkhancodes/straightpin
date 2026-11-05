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
- Next: M1-B (landing and pricing pages).
- Live URL: not deployed yet.
- 5 Nov 2026 M1-A done: kit renamed to Straightpin (product.ts plans = brief prices, lookup keys `straightpin_<plan>_<interval>`, Lifetime one-time checkout), crawl/classify/ml merged (tests run in `npm test`, 228 pass), tomato/paper tokens and Bricolage/Public Sans/JetBrains Mono/Caveat fonts in, `*.product.json` removed. lint, typecheck, test, build green. Landing/pricing copy is still kit sample text (M1-B). Lifetime 1,000 buyer cap not enforced yet.

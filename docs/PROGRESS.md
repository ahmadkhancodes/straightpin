# Progress: Straightpin by BufferSol

## State (5 Nov 2026)
- Phase 0 done and fully approved by the orchestrator (tomato palette, D-009).
- Pure TS modules built while waiting for kit-v1 (no UI, no network in tests, 181 tests):
  - `src/lib/crawl/net/`: robots parser + policy, per host limiter, egress deny list, `fetchPolite`.
  - `src/lib/crawl/adapters/`: Greenhouse, Lever, Ashby, Workable, Recruitee XML, Personio XML.
  - `src/lib/crawl/careers/`: JSON-LD JobPosting extractor, sitemap parser, career site crawler.
  - `src/lib/crawl/dedupe/`, `score/`: MinHash dedupe, repost/ghost signals and labels.
  - `src/lib/classify/` + `ml/agency/`: agency rules, hashed TF-IDF logistic model, training and precision gate.
- Root `package.json`/`tsconfig.json` here are temporary scaffolding: when the kit is copied (KIT_COPY.md), merge devDependencies (vitest, typescript) into the kit's package.json and keep `src/lib/crawl`, `src/lib/classify`, `ml/`.
- Known gaps: no labelled agency data yet (model stays off until the precision gate passes; rules + review queue ship); adapters use hand written fixtures shaped like the public APIs, not recorded live responses (verify against live boards in M2).
- Next: wait for "kit-v1 ready", then M1.
- Live URL: not deployed yet.

# Roadmap (M1–M5, full workbook MVP)

Each milestone: PR → checks green → merge → deploy → docs/PROGRESS.md → one line to the orchestrator. Starts after design approval and `kit-v1`.

| M | Scope | P0s |
|---|---|---|
| M1 | Copy kit, apply DESIGN.md tokens, landing (SECTION_PLAN), /pricing, auth (code + passkeys), billing (Stripe test products, checkout, portal, webhook, cancel, refund), legal pages, DB + user, Vercel deploy, CF cron worker skeleton | P0-1, P0-2 (mail), P0-7 (core billing + free tier) |
| M2 | Directory + robots + rate limiter + feed adapters (Greenhouse, Lever, Ashby, then Workable/Recruitee/Personio), normaliser, closing logic, admin boards + crawl health | P0-3 |
| M3 | JSON LD career crawler, dedupe, repost/ghost scoring, agency classifier + admin labelling + receipt | P0-4, P0-5 |
| M4 | Quiz, live counts, match score, feed, filters, job detail + tear off, opens/paywall, saved jobs, alerts (daily + instant), unsubscribe, SEO role pages, status page, admin queues | P0-6, P0-7 (rest), P0-8 |
| M5 | QA: Playwright 375/1440 light in docs/qa/, Lighthouse 90+, axe, design scorecard (docs/design-qa.md), launch checklist, owner manual steps | all |

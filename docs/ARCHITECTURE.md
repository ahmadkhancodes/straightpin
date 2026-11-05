# Architecture: Straightpin by BufferSol on Vercel + MongoDB Atlas + Stripe + the kit

Scope = full workbook MVP (every P0 in docs/brief.md). The workbook assumes two Hetzner servers; owner decision is Vercel first, VPS later. Anything that needs an always on server sits **behind an interface** (section 6) so it moves without touching callers.

## 1. Stack
Next.js (App Router, Node runtime) · TypeScript strict · Tailwind v4 tokens (docs/DESIGN.md) · MongoDB Atlas (db `straightpin`, user `straightpin-app`) behind the kit's DB interface (Mongo + memory drivers) · Better Auth (kit) · Stripe (kit billing adapter) · kit `Mailer` · Zod · Vitest · Playwright. Kit code is copied at `kit-v1`, never imported. Workbook items replaced: Postgres + Drizzle → Mongo; Paddle → Stripe (owner rule); Auth.js 6 digit code → Better Auth email OTP/magic link + passkeys; pg-boss → Mongo job collection with leases; Hetzner/Ansible/Prometheus/Grafana/Loki/Forgejo/Woodpecker → Vercel + GitHub Actions + `/api/health` + Vercel Analytics (OPS items deferred to VPS, see 6).

## 2. What runs where
| Piece | Where now | Moves to VPS later |
|---|---|---|
| Web app, API, SSR job pages | Vercel functions (Node) | stays |
| Scheduler | Cloudflare Worker cron (free, own account) calling `POST /api/cron/<job>` with `CRON_SECRET`. Vercel Cron is a once a day backstop only (Hobby limit) | a systemd timer or pg-boss style worker calls the same endpoints |
| Feed crawlers (Greenhouse, Lever, Ashby, Workable, Recruitee XML, Personio XML) | `/api/cron/crawl-feeds` fan out: cron enqueues shards; each invocation leases N boards for ~50 s budget, concurrency 8, per host 1 req/s | long running worker uses the same `crawlBoard()` |
| JSON LD career page crawler | `/api/cron/crawl-careers` same shard/lease pattern, 6 hourly | same |
| Company directory + board discovery | weekly job (bulk files fetched in chunks from SEC EDGAR, Companies House, Common Crawl index), resumable cursor in Mongo | VPS does the big bulk imports in one go |
| Agency classifier | in process TypeScript inference (rules + logistic regression weights in JSON), < 20 ms/job. Training is an offline script (`ml/agency/train.ts`) producing `model.json` + metrics; model rows in `model_versions` | optional ONNX runtime on the VPS behind the same `AgencyModel` interface |
| Matching, quiz counts | Mongo indexes + 60 s cache | unchanged |
| Alerts | hourly cron computes new matches per AlertRule, sends via `Mailer` | unchanged |
| Mail | kit provider adapter (Resend) now; SMTP adapter to own Postfix later | own MTA |
| Files (exports) | Cloudflare R2 (own account) | unchanged |
| Monitoring | `/api/health`, Vercel Analytics, GitHub Actions daily synthetic check, crawl health admin page | Prometheus stack, Uptime Kuma |

### Crawl rules (brief, non negotiable)
`net/robots.ts`: `robots_rules` collection (host PK, body, crawl_delay, status ok/disallow_all/error, fetched_at); cache 24 h; 5xx → disallow 24 h; 404 → allowed at 1 req/s. `net/ratelimit.ts`: per host token via atomic `findOneAndUpdate` on `host_state.next_allowed_at` (works across concurrent function instances); ≤ 1 req/s, ≤ 4 concurrent per host; honour Crawl-delay and Retry-After; conditional GET with ETag/If-Modified-Since. User-Agent `StraightpinByBufferSolBot (+https://straightpin.buffersoltech.com/bot)`. Egress allowlist/denylist in one `fetchPolite()` wrapper: deny Indeed, LinkedIn, Glassdoor, directroles.net (DATA-11); no proxies, no headless browser, bot challenge → host `blocked`. XML with DOCTYPE/entities refused. SmartRecruiters adapter present but OFF while robots disallows. Removal requests honoured within 48 h (admin tool sets `suppressed`).

## 3. Data model (Mongo collections, `_id` ObjectId unless noted, TTL fields are `Date`)
Core: `users` (Better Auth; + country, region, tz, plan, entitlement) · `search_profiles` · `passkeys` (Better Auth) · `push_subscriptions` (v2).
Directory: `companies` {name, domain unique, is_agency, naics, sic_code, source, country} · `ats_boards` {company_id, ats, slug, region, status, last_crawled_at, fail_count, etag; unique ats+slug; dead after 3 fails}.
Jobs: `jobs` {board_id, external_id (unique with board_id), title, title_norm, excerpt (≤ 600 chars, not full HTML), country US/CA/UK, region, location, remote_type, pay_min/max/period/currency, apply_url, source_host, first_published_at (never updated_at), last_seen_at, closed_at, miss_count, repost_count_90d, ghost_score, agency_flag, agency_score, dedupe_key, minhash}. Indexes: (country, field, closed_at, first_published_at desc), text(title), (board_id, external_id), (dedupe_key).
Trust: `agency_labels`, `agency_rules` {kind domain/name/phrase/sic, value}, `model_versions`, `job_reports`.
User activity: `matches` (cache), `unlocks` (day, user, job), `saved_jobs` {stage}, `apply_clicks`, `alert_rules` {profile_id, cadence, last_sent_at, active}.
Billing (kit): `subscriptions`, `payments`, `webhook_events` (record after success).
Ops: `robots_rules`, `host_state`, `crawl_logs` (TTL 30 d), `email_messages`, `suppressions`, `skill_terms` (v1), `audit_log`, `job_leases`.
Retention: closed jobs > 180 days deleted (aggregates kept in `daily_stats`), deleted accounts purged in 30 days.

### Storage budget (the biggest technical risk, see section 8)
Excerpt only (brief says short excerpt + link to employer) ≈ 1.2 KB/doc with indexes ≈ 2 KB → 150K jobs ≈ 300 MB, 250K ≈ 500 MB. Atlas free M0 is 512 MB. Plan: M0 for build, `daily_stats` + 180 day purge, crawl only boards in the 8 fields first, and an M10 upgrade is a manual payment step before launch (MANUAL_STEPS).

## 4. Routes and API
Marketing (SSR): `/`, `/pricing`, `/jobs/[role]` (+ remote/city variants), `/ca`, `/uk`, `/compare/[rival]`, `/about/data`, `/bot`, legal pages, `/sitemap.xml`, `/robots.txt`.
App: `/quiz`, `/matches`, `/job/[id]`, `/saved`, `/alerts`, `/account` (plan, cancel, refund, export, delete), `/c/[company]` (v1), `/admin/*` (boards, crawl health, agency queue, labelling, reports, agency list editor).
API: `GET /api/counts?field&answers…` (quiz live count) · `POST /api/profile` · `GET /api/matches` · `POST /api/jobs/[id]/open` (consumes an open) · `POST /api/jobs/[id]/apply-click` · `POST /api/jobs/[id]/report` · `POST /api/saved` · `POST /api/alerts` · `GET/POST /api/unsubscribe` (RFC 8058) · `POST /api/stripe/webhook` · `POST /api/billing/checkout|portal|cancel|refund` · `GET /api/health` · `POST /api/cron/<job>` (jobs: crawl-feeds, crawl-careers, robots, discover-boards, build-directory, score, alerts-instant, alerts-digest, expire, reminders, retention, stats).

## 5. P0 requirements: how each is built + acceptance criteria
IDs follow the workbook roadmap items. Items 1 and 2 (own infra, own mail server) are re-scoped.

**P0-1 Infra foundation → re-scoped.** Vercel project `straightpin` (new account), CF worker cron, GitHub Actions CI, `/api/health`, GlitchTip not used (structured logger + Vercel logs). *Accept:* deploy green, health 200, a test cron fires from CF, alert path (GitHub Action issue/ntfy later) proven. Backups: Atlas continuous/snapshot on paid tier (manual); OPS-01/02 full targets deferred to VPS phase.

**P0-2 Mail + data model.** Kit Mailer (Resend adapter), suppression list, VERP style bounce webhook from the provider, RFC 8058 unsubscribe, per provider send caps in config, sign in codes bypass the digest queue (EMAIL-03). *Accept:* hard bounce suppressed ≤ 1 min after provider webhook; unsubscribe works without login; sign in code sent immediately while a digest batch is queued; DKIM/SPF/DMARC pass on provider domain (own MTA warm up deferred).

**P0-3 Feed crawlers + directory (DATA-01..04, 10).** Adapters with recorded fixtures; normaliser; upsert by (board_id, external_id); Ashby `includeCompensation` → pay_min/max; EU Lever via `api.eu.lever.co`; missing on 2 consecutive crawls → closed (DATA-07); remote_type + country on ≥ 90%; never call paid APIs or proxies. Directory build from bulk files; board discovery probes URL patterns, ≤ 5 slugs per company. *Accept:* ≥ 95% of live boards fetched each hour (sharded); upsert idempotent test; 0 robots violations in crawl_logs; ≥ 20K companies with domain and ≥ 5K verified boards at launch; ≥ 150K active US/CA/UK jobs subject to the storage plan (target set at launch as `{{launch_job_target}}`).

**P0-4 Career page crawler + trust signals (DATA-05, TRUST-02/03).** Sitemap + JSON LD `JobPosting` parser; ≤ 1 req/s per host; challenge → host blocked; expired closed within 24 h (validThrough, 404). Dedupe: hash(company_id, title_norm, location_norm) + MinHash 128, Jaccard ≥ 0.85 in 7 days. Repost count over 90 days; "old posting" badge after 30 days; first posted never `updated_at`. Admin crawl health page. *Accept:* ≤ 1% duplicates on a 500 job sample; badge on 100% of jobs; ≥ 250K jobs target as above.

**P0-5 Agency classifier (TRUST-01).** Pipeline: rules (agency list, apply domains, phrases "our client", "on behalf of", "staffing", "contract to hire via", SIC 7363 / UK 78100–78300) → logistic regression over word + char n grams (weights JSON, pure TS inference) → score; 0.35–0.65 to admin review queue; admin labelling tool; receipt "We removed N staffing agency posts from this list." *Accept:* precision ≥ 95% and recall ≥ 85% on 500 job held out sample before a model is activated (gate in `model_versions`); roadmap gate ≥ 93% on 300 job sample in M3; < 20 ms/job (benchmark test). Initial labels: seed from rules + manual labelling (≥ 3K labels target; if short, ship rules only plus review queue and log it).

**P0-6 Quiz + matches + auth (ONB-01..04, SRCH-01/02).** Landing chips with live counts; 6 question quiz, one per screen; `/api/counts` p95 < 300 ms (cached 60 s, indexes); price visible above the fold desktop / first 2 screens mobile; Better Auth email code (10 min, 5 attempts then 15 min lock, 30 day session) + passkeys + optional Google; deterministic match score (title taxonomy, remote/location, pay floor, experience, schedule; same input same order; one line reason per card); filters with URL state; job detail with tear off. Server rendered fallback without JS. *Accept:* new user reaches 5 open matches in < 2 min on mobile (Playwright timing test); count never negative; 0 matches offers to relax last answer.

**P0-7 Billing (ACC-01/02, TRK-01, ALTCHA).** Stripe Checkout (Weekly $4.99, Monthly $10.99, Lifetime $23.99, `metadata.app=straightpin`, lookup_keys `straightpin_weekly|monthly|lifetime|plus_monthly|plus_annual`), Portal, webhook (idempotent, recorded after success, entitlements recomputed from Stripe), 2 tap cancel, 7 day self serve refund (full refund turns plan off), renewal reminders (3 days before; before 3rd weekly renewal nudge to Monthly), lifetime cap 1,000, free tier 5 opens/day + 10 saves, ALTCHA + kit rate limiter (sign up flood 1K/min blocked). Legal pages: Terms, Privacy, Refund, UK cookie notice, CCPA/PIPEDA. *Accept:* paid access visible ≤ 5 s after webhook; webhook replay safe; refund ≤ 7 days works end to end in test mode; late webhook shows "We'll email you when active".

**P0-8 Alerts + launch (ALR-01/02, ADM-01/02).** Free daily digest at 08:00 local (hourly cron picks users whose local hour = 8); paid instant alerts hourly, > 20 new → digest; bounced address disables + banner; pricing page; SEO role pages (target 50 then 200); status page; admin (boards, crawl health, agency queue, reports, agency list editor). *Accept:* median first_published → email < 60 min measured on test boards; one click unsubscribe; bounce < 2% and complaints < 0.1% tracked from provider webhooks.

**Cross cutting.** Job detail shows first posted, repost count, last checked, source host; tear off logs ApplyClick and adds "Applied?" to tracker; "Did you apply?" on return. Account: export JSON, delete within 30 days. NFRs: LCP < 2.0 s, INP < 200 ms, CLS < 0.05, WCAG 2.2 AA (axe in CI), quiz count p95 < 300 ms, Lighthouse 90+.

## 6. Behind interfaces (move to VPS later)
`Scheduler` (CF worker ↔ systemd), `JobQueue` (Mongo leases ↔ pg-boss/BullMQ), `Fetcher` (`fetchPolite` ↔ same on VPS with fixed egress IP), `AgencyModel` (TS weights ↔ ONNX), `Mailer` (Resend ↔ SMTP/own MTA), `ObjectStore` (R2), `SearchIndex` (Mongo text now ↔ Postgres FTS/Meili later), `BillingAdapter` (Stripe ↔ Paddle).

## 7. Security and compliance
Kit rules: httpOnly `__Host-` cookies, CSRF/Origin check, Zod everywhere, CSP, append only audit log. Rate limits on counts, auth, unsubscribe, report. No resume upload (in browser only, v1). Copy never promises jobs. Consumer law copy review gate for renewals and refunds.

## 8. Risks (ranked)
1. **Storage and function time budget.** 150K to 250K jobs hourly on Atlas free tier and Vercel functions (60 s Hobby, longer on Pro) is tight. Mitigation: excerpt only, sharded leases, conditional GET, prioritise 8 fields, `daily_stats` purge, M10 + Vercel Pro before launch.
2. **Coverage/data volume at launch.** ≥ 20K companies and ≥ 5K boards need bulk files; may need the VPS. Mitigation: ship at whatever the crawl reaches, expose real counts, never fake.
3. Classifier labels (≥ 3K) do not exist; precision gate may keep the model off at first (rules + review queue still ship).
4. Source fragility (Workable 429, Recruitee token from 10 Feb 2027, SmartRecruiters robots).
5. Hobby plan is non commercial; Pro required before taking money.
6. Deliverability on a provider domain until own MTA.

# Batch 1 plan: 7 SaaS, full workbook MVP, start 5 Nov 2026 10:00 PKT (05:00 UTC)

Owner decisions (4 Nov 2026):
- **Scope: full workbook MVP** (every P0 requirement in each workbook), not a cut-down v1.
- **Infra: the new Vercel account for now**; Ahmad will give a VPS later for the parts that need always-on servers.
- **Reuse:** build the universal parts once in SaaS #1, then copy them into every other repo (copy, never a shared dependency). Backend logic is ported from the mobile apps (see `docs/BACKEND_REUSE.md`).
- **Design:** world-class and ICP-specific, never the "Claude look". Method: `design-kit/DESIGN_PLAYBOOK.md` + the `landing-page-design` skill (elayadesign, MIT).
- **Models:** Sonnet does the building. Opus only for the universal kit (the foundation for all 50) and for rescues; the orchestrator reviews.

## The 7 products
| # | Repo | Product | What it is | Vercel-first adaptation (VPS later) |
|---|---|---|---|---|
| 1 | `postslot` | Postslot | Form backend with delivery receipts (Web3Forms challenger) | Endpoint, spam engine, inbox, billing on Vercel. Mail goes out through the kit's `Mailer` interface (provider adapter now, own KumoMTA/Postfix on the VPS later). Hosts the **universal kit**. |
| 2 | `wirebook` | Wirebook | QuickBooks Desktop as a REST API (Conductor challenger) | Web Connector SOAP endpoint, per-file queue (Mongo), REST /v1, connect flow, dashboard, SDKs (TS, Python) generated from OpenAPI. |
| 3 | `dockcrate` | DockCrate | MSP Intune app packaging, rings, rollback (Pckgr challenger) | Entra multi-tenant app + Microsoft Graph from Vercel functions; catalog from public winget manifests; Windows test-VM verification moves to the VPS. |
| 4 | `hotrail` | Hotrail | Capacitor live updates (Capgo challenger) | Update API hot path on Vercel; bundles on Cloudflare R2 (free tier, our own account); own MIT Capacitor plugin + CLI + MCP server published to npm. |
| 5 | `stepclimb` | Stepclimb | Verified Laravel upgrade PRs (Laravel Shift challenger) | GitHub App; upgrade runs in **Vercel Sandbox** microVMs (PHP + Composer installed per run); recipes and repair rules in-house. |
| 6 | `inboxwire` | Inboxwire | One API over Gmail/M365/IMAP mailboxes (EmailEngine challenger) | Gmail push (Pub/Sub) and Graph notifications go straight to Vercel webhooks; IMAP polled by cron until the VPS runs IDLE workers; self-host Docker image built in GitHub Actions. |
| 7 | `straightpin` | Straightpin | Direct-from-employer job board, no agencies (DirectRoles challenger) | Crawlers (Greenhouse/Lever/Ashby/…, JSON-LD career pages) run as cron-triggered Vercel functions; agency classifier in-house; alert emails via `Mailer`. |

All live at `<slug>.buffersoltech.com` (single hostname each, per the workbooks).

## Standing technical decisions (logged here, copied into each repo's DECISIONS.md)
- **Database:** MongoDB Atlas, new project "BufferSol SaaS", free cluster `buffersol-saas` (separate from the mobile apps' cluster). One database + one DB user per SaaS. The workbooks say Postgres; we use Mongo behind the ported DB interface so the code is the one we already trust, and swapping later stays possible.
- **Auth:** Better Auth (self-hosted library, which the workbooks name) with magic link, passkeys, TOTP, orgs/roles, API keys; MongoDB adapter; httpOnly cookies.
- **Payments:** Stripe (connected, test mode first) for every product, behind a billing adapter. Some workbooks prefer Paddle as merchant of record; it becomes a second adapter later if Ahmad wants it.
- **Email:** the kit's `Mailer` interface. On Vercel there is no own MTA, so a transactional provider adapter sends for now; own Postfix/KumoMTA on the VPS later. Same code path.
- **Schedulers:** Vercel Cron where the plan allows; otherwise a tiny Cloudflare Worker cron per SaaS (free, every minute) calling `/api/cron/*` with a secret.
- **Storage:** Cloudflare R2 (own account) for files and bundles.
- **Vercel plan:** Hobby is non-commercial and has 1 cron/day plus short function limits. **Selling needs Vercel Pro** before launch (Ahmad, payment step).
- **Deploys:** keep only the latest 3 deployments (`scripts/vercel-keep-latest-3.sh`), CLI deploy with `VERCEL_TOKEN_NEW_ACCOUNT`.

## Universal kit (built first, in `postslot`, tagged `kit-v1`)
Spec: `UNIVERSAL_KIT.md`. One Opus session, about half a day.

## Schedule (PKT)
- **Day 1, 10:00:**
  - Kit session (Opus) starts in `postslot`.
  - At the same time, 6 product sessions (Sonnet) start **Phase 0**, which is no-code work: read the brief + design kit, research competitors' live sites, then write `docs/DESIGN.md` (visual direction from the ICP), `docs/SECTION_PLAN.md` (landing), `docs/ARCHITECTURE.md` (Vercel adaptation, data model, P0 list with acceptance criteria) and `docs/ROADMAP.md`.
  - The orchestrator reviews each DESIGN.md before any UI code is written.
- **When `kit-v1` is tagged:** each session copies the kit (attach `postslot` read-only, copy at the tag, rename), then builds milestones:
  - **M1:** landing, pricing, auth, billing, legal, deploy.
  - **M2–M4:** P0 features in workbook order.
  - **M5:** QA (Playwright screenshots 375/1440 light, Lighthouse 90+, design scorecard), launch checklist.
  - Postslot continues with its own product work after the kit.
- **Orchestrator check-ins every ~2 h** (scheduled): read each repo's `docs/PROGRESS.md`, merge PRs, unblock, handle usage-limit resumes.

## Manual steps
Full list for Ahmad / the Claude browser extension: `MANUAL_STEPS_BATCH1.md`. **Nothing there blocks the 10:00 start.** Missing keys mean sessions build with stubs (console mailer, Stripe test via the connector, `*.vercel.app` hosts) and wire the real env vars in when they appear (`STRIPE_SECRET_KEY_TEST`, `RESEND_API_KEY`, `CLOUDFLARE_SAAS_TOKEN`, `CLOUDFLARE_SAAS_ACCOUNT_ID`).

Summary (status as of 4 Nov):
1. ~~Create the 7 empty repos~~ (done 4 Nov).
2. Store credentials as environment variables: Stripe test secret key, a mail-provider key, and a Cloudflare token with DNS edit on buffersoltech.com + R2.
3. ~~Atlas network access~~ (done 4 Nov, Ahmad approved).
4. Later, per product (each session prepares the exact link or manifest):
   - Azure app registrations (DockCrate, Inboxwire).
   - Google OAuth + Pub/Sub (Inboxwire).
   - GitHub App via a one-click manifest (Stepclimb).
   - npm token (Hotrail, Wirebook SDKs).
   - Vercel Pro upgrade before taking real money.

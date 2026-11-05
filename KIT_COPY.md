# KIT_COPY: start a new BufferSol SaaS from the universal kit (`kit-v1`)

The kit lives in `ahmadkhancodes/postslot` at tag **`kit-v1`**. Copy it; never import it. Time: about 30 minutes.

## 1. Copy the code at the tag
```bash
# in the new product repo (empty except docs/)
git -C /tmp clone --depth 1 --branch kit-v1 https://github.com/ahmadkhancodes/postslot kit
rsync -a --exclude .git --exclude node_modules --exclude .next --exclude 'docs/qa' --exclude 'docs/design' \
  --exclude 'docs/brief.md' --exclude 'docs/PROGRESS.md' --exclude 'docs/DECISIONS.md' --exclude 'docs/ROADMAP.md' \
  --exclude 'docs/STRIPE.md' --exclude 'docs/MANUAL_STEPS.md' --exclude CLAUDE.md /tmp/kit/ ./
npm ci
```
Keep your repo's own `CLAUDE.md`, `docs/brief.md` and memory files. Take `docs/factory/` and `.claude/skills/` only if missing.

## 2. Rename the product (one file + tokens)
1. `src/config/product.ts`: `slug` (lowercase, also the DB name, cookie prefix and Stripe lookup-key prefix), `name`, `fullName`, `host`, `url`, `mailFrom`, `description`, `tagline`, `legal`, `subProcessors`, `plans` (real prices in cents, limits per meter, highlights), `graceDays`, `flags`, `nav`. Keep every plan's `lookupKey` shape `${slug}_${plan}_${monthly|annual}` (the `price()` helper does it).
   If your meters differ, edit the `MeterId` union at the top.
2. `package.json` `name` = slug. `infra/cron-worker/wrangler.toml` `name` and `APP_URL`.
3. Design: primary colour family must not repeat another BufferSol product (orchestrator keeps PALETTE_REGISTRY.md). Visual system from your `docs/DESIGN.md`: replace ONLY the values in the two `:root` blocks of `src/app/globals.css` (raw ramp, accent, role tokens for light and dark) and the two font lines in `src/app/fonts.ts`. Components reference role tokens only.
4. Replace the sample landing `src/app/(marketing)/page.tsx` and the demo `src/components/marketing/demo/*` with your product's sections and real UI. Replace `src/app/app/page.tsx` with your main screen. Update `src/content/compare.ts`, `src/content/docs/*`.
5. `grep -rn "postslot\|Postslot" src scripts infra` must only hit `product.ts` (and your own content).

## 3. Infrastructure
- **MongoDB** (Atlas project "BufferSol SaaS" `6aeaf54cfcddba149e782d8d`, cluster `buffersol-saas`): create DB user `<slug>-app` with role `readWrite` on database `<slug>` only (MongoDB connector `atlas-create-db-user`, or ask the orchestrator).
  `MONGODB_URI=mongodb+srv://<slug>-app:<pw>@buffersol-saas.za2stqu.mongodb.net/?retryWrites=true&w=majority`, `MONGODB_DB=<slug>`. Then `npm run db:indexes` once.
- **Stripe** (test mode, `acct_1N578JBkP5VKCzMY`): `STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY_TEST npm run stripe:setup` (idempotent, refuses other apps' keys). Or create the same objects with the Stripe connector: every product/price `metadata.app=<slug>`, lookup keys `<slug>_...`. Record ids in `docs/STRIPE.md`.
  After the first deploy create a webhook endpoint `<url>/api/stripe/webhook` for `checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.paid, invoice.payment_failed, charge.refunded, payment_intent.succeeded` and put its `whsec_` in `STRIPE_WEBHOOK_SECRET`.
  Enable the Customer Portal (test mode) once per account: https://dashboard.stripe.com/test/settings/billing/portal
- **Vercel: deploy ONLY to the new account** (team `ahmad-code`, id `team_rbOXRpz6zmliuGsw8eIh3YDw`) with `VERCEL_TOKEN_NEW_ACCOUNT` via CLI/REST. Never use `VERCEL_TOKEN` or the Vercel MCP connector: both point at the OLD account, which is at its limit. Project creation: `curl -X POST -H "Authorization: Bearer $VERCEL_TOKEN_NEW_ACCOUNT" "https://api.vercel.com/v11/projects?teamId=team_rbOXRpz6zmliuGsw8eIh3YDw" -d '{"name":"<slug>","framework":"nextjs"}'`. Then: `npx vercel link --yes --project <slug> --scope team_rbOXRpz6zmliuGsw8eIh3YDw --token "$VERCEL_TOKEN_NEW_ACCOUNT"`, then set Production env:
  `APP_NAME, NEXT_PUBLIC_APP_URL, MONGODB_URI, MONGODB_DB, BETTER_AUTH_SECRET (openssl rand -base64 32), STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, MAIL_PROVIDER (console|resend), RESEND_API_KEY, MAIL_FROM, CRON_SECRET, ALTCHA_HMAC_KEY, ADMIN_EMAILS, APP_FLAGS`
  (`printf %s "$VALUE" | npx vercel env add NAME production --token ...`). Stub mode: without `MONGODB_URI` the app runs on the memory driver; without Stripe keys checkout answers 503 `billing_unavailable`; with `MAIL_PROVIDER=console` + `MAIL_CONSOLE_PRINT=1` magic links appear in the function logs.
- **Deploy**: `scripts/deploy.sh <slug>` (deploys prod, then runs `scripts/vercel-keep-latest-3.sh <slug>`).
- **Cron**: Vercel Hobby allows 1 cron/day (`vercel.json`). For per-minute jobs deploy `infra/cron-worker` to Cloudflare with `CRON_SECRET`.

## 4. Checks (all must pass before the first PR)
```bash
npm run lint && npm run typecheck && npm test && npm run build
npx playwright test                  # e2e on the memory driver (starts next start on :3100)
npm run screenshots                  # BASE_URL defaults to http://localhost:3000 (run `npm start` first)
```
Design gate: score `docs/factory/DESIGN_PLAYBOOK.md` §9 into `docs/design-qa.md`; run its quick greps.

## 5. What the kit gives you (map)
| Area | Where |
|---|---|
| Product constants, plans, limits, flags | `src/config/product.ts` |
| Tokens, type styles, spacing scale | `src/app/globals.css`, `src/app/fonts.ts` |
| UI primitives (button, field, states, layout, reveal) | `src/components/ui/*` |
| Marketing sections, pricing table, FAQ, tagline reveal, header/footer | `src/components/marketing/*`, `src/app/(marketing)/*` |
| Legal (privacy, terms, DPA, security, sub-processors, cookies, AUP) | `src/content/legal/*`, `/legal/[doc]` |
| Docs + llms.txt | `src/content/docs/*`, `/docs`, `/llms.txt`, `/llms-full.txt` |
| SEO: sitemap, robots, OG/twitter image, icons, `pageMetadata()` | `src/app/*.ts(x)`, `src/lib/seo.ts` |
| Auth (magic link, passkeys, TOTP, orgs + roles, API keys, `__Host-` cookies) | `src/lib/auth/*`, `/api/auth/*`, `(auth)` pages |
| Session helpers, permission guard, API-key auth | `src/lib/auth/session.ts`, `src/lib/auth/roles.ts` |
| DB interface + memory/Mongo drivers + contract test | `src/lib/db/*`, `tests/unit/dbContract.ts` |
| Billing: checkout, portal, webhook, entitlements, gating, metering | `src/lib/billing/*`, `/api/billing/*`, `/api/stripe/webhook` |
| Mailer (console/resend/smtp stub), templates, suppression, one-click unsubscribe | `src/lib/mail/*`, `/api/mail/unsubscribe` |
| Rate limit, ALTCHA, disposable domains, CSRF, headers/CSP | `src/lib/security/*`, `src/lib/http.ts` |
| Audit log | `src/lib/audit.ts`, `/app/settings/audit` |
| Outbound webhooks (HMAC, retries, delivery log) | `src/lib/webhooks/outbound.ts`, `/api/webhooks/*` |
| Cron | `/api/cron/[job]`, `src/lib/cron/jobs.ts`, `infra/cron-worker/` |
| App shell, settings, founder admin | `src/app/app/*`, `src/app/admin/*`, `src/components/app/*` |
| Ops | `/api/health`, `/api/config`, `src/lib/logger.ts`, error boundaries, Vercel Analytics |
| QA + deploy | `scripts/screenshots.ts`, `scripts/deploy.sh`, `.github/workflows/ci.yml`, `tests/` |

## 6. Rules that come with the kit
- Every Mongo route: `export const runtime = "nodejs"`. Index creation only via `npm run db:indexes`.
- Billing truth = Stripe; entitlements are recomputed, never patched; event ids recorded only after success.
- Never trust a client flag for plans: gate with `requirePlan()` on the server.
- Cookie-auth POST/PATCH/DELETE go through `withApi()` (Origin check). Signed endpoints (Stripe, unsubscribe, cron) opt out explicitly.
- Next.js 16: middleware is `src/proxy.ts`; Cache Components are off (decision D-K3).
- Cloud sessions cannot push tags through the git proxy: run the "Create tag" workflow (`.github/workflows/tag.yml`) instead.

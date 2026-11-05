# BufferSol SaaS factory: 50 SaaS in 30 days (challenge started 3 Nov 2026)

This is the brief every SaaS build session gets. The orchestrator pastes it (plus the app's workbook) into each new session.
Owner: Ahmad (BufferSol Technologies). Orchestrator: this repo (`ahmadkhancodes/dummy`), file `SAAS_TRACKER.md`.

## How a batch flows
1. Ahmad sends 5 ideas, each with a workbook (research, feasibility, pricing, competitors, design direction).
2. Orchestrator writes `briefs/<slug>.md` here (workbook + this factory brief) and gives Ahmad 5 prefilled "create repo" links (one click each).
3. Orchestrator starts **one session per SaaS** (`create_session`, `source_url` = the new repo, Sonnet by default).
4. Each session builds, self-QAs with Playwright screenshots, deploys to the SaaS Vercel account, and opens a PR. The orchestrator reviews the design screenshots, merges and updates `SAAS_TRACKER.md`.
5. Ahmad gets one message per batch: live URLs + any truly manual step (deep link first, 3 lines max).

## Default stack (change only if the workbook needs it)
- **Next.js (App Router) + TypeScript + Tailwind CSS**, deployed on Vercel. One repo = one Vercel project.
- **Database:** MongoDB Atlas, cluster `buffersol-apps`, one database per SaaS (name = slug). Mongoose or the native driver.
- **Auth:** Auth.js (NextAuth) with Google + email magic link. Google OAuth app "BufferSol Apps" (GCP project `buffersol-apps`).
- **Payments:** Stripe, BufferSol Technologies account `acct_1N578JBkP5VKCzMY`. Products/prices created in **test mode** first, tagged `metadata.app=<slug>`; prices exactly as the workbook says (USD, plus GBP/CAD where listed). Stripe Checkout + Customer Portal + one webhook route.
- **Email:** Resend (only if the product sends email).
- **Analytics:** Vercel Web Analytics. No ads, no trackers beyond that.
- **AI features:** only when the workbook's core feature needs it; server-side only, key from env, never exposed to the client.
- Keep dependencies small. One problem, solved very well.

## Design rules (the most important part)
The product must look like it belongs next to its best competitor, not like a template or an "AI-made" site.
- **Start from the workbook's design direction and competitor references.** Before coding, write `docs/DESIGN.md`: 2-3 reference products, the palette (hex tokens), type pair, radius, spacing scale, icon set, motion rules and voice. Every screen follows it.
- **Banned "AI look":** purple-to-blue gradients by default, glassmorphism everywhere, emoji as icons, generic "Supercharge your workflow" copy, centred-everything hero with three identical feature cards, random glows, Inter-on-white with nothing else, lorem ipsum, fake logos or fake testimonials.
- **Do:** a real type pairing (Google Fonts via `next/font`), a restrained palette with one confident accent, real product UI in the hero (a live demo or a true screenshot of the app, not an illustration), specific copy written for the buyer in the workbook, consistent 4/8 px spacing, crisp empty/loading/error states, dark mode if competitors have it.
- **Responsive:** perfect at 375 px, 768 px and 1440 px. No horizontal scroll. Tap targets at least 44 px.
- **Accessibility:** WCAG AA contrast, keyboard focus visible, labels on inputs.
- **Pages every SaaS ships:** landing (hero with the product, problem, how it works, features, pricing, FAQ, final CTA), the app itself, pricing, sign in, account/billing, privacy, terms, 404. Footer: "A BufferSol product".
- **SEO:** title/description per page, Open Graph image, sitemap.xml, robots.txt, favicon set.

## Definition of done (each SaaS)
- Core flow works end to end in production: visitor -> sign up -> use the one core feature -> upgrade with a Stripe test card -> plan active.
- `npm run build`, lint and typecheck pass. A small test set covers the core logic and the Stripe webhook.
- Playwright screenshots of every page at 375 and 1440 px, light and dark, saved in `docs/qa/` and checked against `docs/DESIGN.md`. Lighthouse 90+ on performance, accessibility, SEO for the landing page.
- Deployed on the **SaaS Vercel account** (`$VERCEL_TOKEN_NEW_ACCOUNT`, never the old `VERCEL_TOKEN`), env vars set in Vercel, production URL recorded.
- `README.md`, `docs/PROGRESS.md`, `docs/DECISIONS.md`, `docs/DESIGN.md` written and up to date.

## Vercel deployment policy: keep only the latest 3 deployments
- Ahmad's rule (3 Nov 2026): every project on the SaaS Vercel account keeps **only its newest 3 deployments**. The live production deployment is never deleted.
- Each SaaS repo carries `scripts/vercel-keep-latest-3.sh` (copied from the orchestrator repo; the orchestrator pastes it into the session prompt). **Run `scripts/vercel-keep-latest-3.sh <project>` right after every deploy.**
- Deploy with the CLI: `npx vercel deploy --prod --token "$VERCEL_TOKEN_NEW_ACCOUNT" --yes`. Avoid preview deploys unless needed; each one counts toward the 3.
- Backstop: a daily scheduled task runs the script across all projects.

## Memory lives in GitHub
- In each SaaS repo: `docs/PROGRESS.md` (what's done, what's next, live URL), `docs/DECISIONS.md` (why), `docs/DESIGN.md` (the design system). Read them at the start of every job, update them at the end.
- In this repo: `SAAS_TRACKER.md` (all 50, status, links) and `briefs/<slug>.md`.

## Efficiency rules
- Sonnet for build sessions; Opus only for hard bugs or a design rescue; Haiku for checks.
- One session per SaaS, one narrow task each. Archive the session when the PR is merged and the deploy is verified.
- Never commit or print secrets. Secrets live in the environment or in Vercel env vars.

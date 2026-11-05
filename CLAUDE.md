# Straightpin by BufferSol: project memory for Claude Code

Live target: https://straightpin.buffersoltech.com (until DNS is ready: the `*.vercel.app` URL in docs/PROGRESS.md)
Part of the BufferSol "50 SaaS in 30 days" challenge. The orchestrator is the session `session_01Mn59CnGYFsETSnQdPMcWxP`. Report milestones to it with the claude-code-remote `send_message` tool.

## Read first, every session
1. `docs/PROGRESS.md` (state + next step), `docs/DECISIONS.md`, `docs/ROADMAP.md`.
2. `docs/brief.md`: the product brief distilled from the research workbook. It's the source of truth for scope (full workbook MVP), pricing, ICP, competitors.
3. `docs/factory/`: SAAS_FACTORY.md (rules), BATCH1_PLAN.md (Vercel-first adaptations + standing decisions), UNIVERSAL_KIT.md, BACKEND_REUSE.md, DESIGN_PLAYBOOK.md.
4. Design skill: `.claude/skills/landing-page-design/SKILL.md`. Use it for every marketing page and for UI direction.

## Owner rules (Ahmad)
- Scope = the **full workbook MVP** (every P0 in docs/brief.md). Infra = the **new Vercel account** (`VERCEL_TOKEN_NEW_ACCOUNT`). Parts that need always-on servers are built behind interfaces so they move to a VPS later.
- **Design is the #1 priority.** It must look like it belongs next to the best competitor for this ICP, never like a generic AI template. Follow docs/factory/DESIGN_PLAYBOOK.md and its bans.
- No dependency on other BufferSol repos at runtime. Code is **copied** from the universal kit (`ahmadkhancodes/postslot` @ tag `kit-v1`) and the mobile apps (see BACKEND_REUSE.md), never imported.
- Don't ask the owner questions. Decide, log it in docs/DECISIONS.md, continue. Only truly manual things (logins, payments, console clicks) go into `docs/MANUAL_STEPS.md` with the exact deep link, and get reported to the orchestrator.
- Never commit or print secrets. Secrets live in env vars (cloud environment) and Vercel project env.
- Keep only the latest 3 Vercel deployments: run `scripts/vercel-keep-latest-3.sh <project>` after every deploy.
- Efficiency: use Sonnet subagents for parallel chunks. Read only what you need. Memory lives in this repo, not in chat.

## Available credentials (env vars, may appear later; use stubs until then)
`VERCEL_TOKEN_NEW_ACCOUNT` (set). Coming from the owner: `STRIPE_SECRET_KEY_TEST`, `RESEND_API_KEY`, `CLOUDFLARE_SAAS_TOKEN`, `CLOUDFLARE_SAAS_ACCOUNT_ID`. Connectors you may have: Stripe (test mode, account acct_1N578JBkP5VKCzMY), MongoDB Atlas (project "BufferSol SaaS" 6aeaf54cfcddba149e782d8d, cluster `buffersol-saas`; create DB `straightpin` + a DB user `straightpin-app` with readWrite on it only), Vercel. Stripe objects must carry `metadata.app=straightpin` and lookup_keys prefixed `straightpin_`. Never touch another app's objects.

## Definition of done per milestone
lint + typecheck + tests + build green; deployed; Playwright screenshots (375/1440, light/dark) in docs/qa/; docs/PROGRESS.md updated; PR merged to main.

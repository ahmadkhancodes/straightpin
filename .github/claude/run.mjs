/* eslint-disable */
// Claude task runner for GitHub Actions. Runs on the Anthropic API key only
// (Agent SDK billing), never on a claude.ai subscription login.
import { query } from "@anthropic-ai/claude-agent-sdk";
import { appendFileSync, writeFileSync } from "node:fs";

const MODELS = {
  haiku: { id: "claude-haiku-5-5", cap: 1 },
  sonnet: { id: "claude-sonnet-5-5", cap: 6 },
  opus: { id: "claude-opus-5-5", cap: 15 },
};
const HARD_MAX_USD = 20;

for (const v of ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_AUTH_TOKEN"]) delete process.env[v];
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set; refusing to run.");
  process.exit(1);
}

const task = (process.env.TASK || "").trim();
if (!task) {
  console.error("TASK is empty.");
  process.exit(1);
}
const tier = MODELS[(process.env.MODEL_TIER || "sonnet").toLowerCase()] ?? MODELS.sonnet;
const budget = Math.min(Number(process.env.BUDGET_USD) || tier.cap, HARD_MAX_USD);

const rules = `
You are running unattended in GitHub Actions on the repository in the current directory.
- First read CLAUDE.md, docs/PROGRESS.md and docs/DECISIONS.md if they exist, and follow them.
- Do only the task below. Keep the change as small as the task needs.
- Never print, log or commit secrets. Never add libraries outside the repo's stack unless the task names them.
- Never show ads and never call an LLM from the app.
- You have no internet access tools; rely on the repo and your own knowledge.
- Run the repo's tests and type checks for what you change; fix what you broke.
- Do not run git commit or git push and do not open pull requests: the workflow does that.
- At the end, add a dated line to docs/PROGRESS.md and end your reply with a short summary of what changed and what is left.`;

let result;
for await (const msg of query({
  prompt: task,
  options: {
    model: tier.id,
    maxBudgetUsd: budget,
    maxTurns: 120,
    cwd: process.cwd(),
    settingSources: ["project"],
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    // Web search/fetch carry separate per-use fees that the $480 promo credit does not cover.
    disallowedTools: ["WebSearch", "WebFetch"],
    env: { ...process.env, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1" },
    systemPrompt: { type: "preset", preset: "claude_code", append: rules },
  },
})) {
  if (msg.type === "result") result = msg;
}

const cost = result?.total_cost_usd ?? 0;
const status = result?.subtype ?? "no_result";
const summary = (status === "success" ? result.result : `Stopped: ${status}`) || "";
writeFileSync(
  "/tmp/claude-result.json",
  JSON.stringify({ model: tier.id, budget, cost, status, summary }),
);
const line = `Model ${tier.id} · budget $${budget} · estimated cost $${cost.toFixed(4)} · ${status}`;
console.log(line);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n\n${summary}\n`);
}
process.exit(status === "success" && !result?.is_error ? 0 : 2);

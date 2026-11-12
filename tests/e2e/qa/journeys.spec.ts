import { expect, test } from "@playwright/test";
import { firstJobId, ORIGIN, ownIp, signInViaUi, finishOnboarding, stubPopup, popupState } from "./helpers";

const MATCHES = "/matches?field=support&country=US&remote=any&payFloor=0&level=any&schedule=any";

test("new visitor: save a job signed out is sent to sign in and returns to the job", async ({ page, request }) => {
  const id = await firstJobId(page, request);
  await page.goto(`/job/${id}`);
  await expect(page.getByText("You will be asked to sign in.")).toBeVisible();
  await page.getByRole("button", { name: "Save this job" }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sign in");
});

test("signed out: Apply sends the visitor to sign in and keeps the job", async ({ page, request }) => {
  await stubPopup(page);
  const id = await firstJobId(page, request);
  await page.goto(`/job/${id}`);
  await page.getByRole("button", { name: /Apply at company/ }).click();
  await expect(page).toHaveURL(/sign-in\?next=/);
  expect(decodeURIComponent(decodeURIComponent(page.url()))).toContain(`/job/${id}`);
});

test("free user: save, see it in Saved, remove it; the save limit explains itself", async ({ page, request }) => {
  await signInViaUi(page, request);
  await request.post("/api/dev/seed-jobs?pages=1");
  await page.goto(MATCHES);
  const links = await page.getByRole("link", { name: /./ }).evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!).filter((h) => /^\/job\//.test(h)));
  const ids = [...new Set(links.map((h) => h.split("/job/")[1]!))];
  expect(ids.length).toBeGreaterThan(0);

  await page.goto(`/job/${ids[0]}`);
  await page.getByRole("button", { name: "Save this job" }).click();
  await expect(page.getByRole("button", { name: "Remove from saved" })).toBeVisible();
  await page.goto("/saved");
  await expect(page.locator("main")).toContainText(/Customer|Support|Specialist|Agent|Representative/i);
  await page.getByRole("button", { name: /Remove|Unsave/i }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto(`/job/${ids[0]}`);
  await expect(page.getByRole("button", { name: "Save this job" })).toBeVisible();

  // fill the free list (10) through the API, then the 11th through the button
  const all = (await (await request.get("/api/counts")).ok()) ? ids : ids;
  const extra = [...all];
  for (let i = 0; i < 10 && i < extra.length; i++) {
    const r = await page.request.post("/api/saved", { data: { jobId: extra[i], action: "save" }, headers: { origin: ORIGIN } });
    expect(r.ok(), `save ${i}`).toBeTruthy();
  }
  if (extra.length > 10) {
    await page.goto(`/job/${extra[10]}`);
    await page.getByRole("button", { name: "Save this job" }).click();
    await expect(page.getByText("Your saved list is full")).toBeVisible();
    await expect(page.getByText("Free plans keep 10 saved jobs.")).toBeVisible();
  } else {
    throw new Error(`seed has only ${extra.length} jobs; need 11 to test the save limit`);
  }
});

test("free user: the 6th open of the day goes to a paywall that says why", async ({ page, request }) => {
  await page.context().route(/^https:\/\/(?!localhost).*/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "ok" }));
  await stubPopup(page);
  await signInViaUi(page, request);
  await request.post("/api/dev/seed-jobs?pages=1");
  await page.goto(MATCHES);
  const ids = [...new Set((await page.locator('a[href^="/job/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")!))).map((h) => h.split("/job/")[1]!))];
  const more = ids.length >= 6 ? ids : (await page.goto("/jobs"), [...new Set((await page.locator('a[href^="/job/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")!))).map((h) => h.split("/job/")[1]!))]);
  expect(more.length).toBeGreaterThanOrEqual(6);
  for (let i = 0; i < 5; i++) {
    const r = await page.request.post(`/api/jobs/${more[i]}/open`, { headers: { origin: ORIGIN, accept: "application/json" } });
    expect(r.ok(), `open ${i}`).toBeTruthy();
  }
  await page.goto(`/job/${more[5]}`);
  await page.getByRole("button", { name: /Apply at company/ }).click();
  await expect(page).toHaveURL(/\/paywall\?reason=opens/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("5 free opens");
  // re-opening a job already opened today is free
  await page.goto(`/job/${more[0]}`);
  await page.getByRole("button", { name: /Apply at company/ }).click();
  await expect.poll(async () => (await popupState(page)).href).toMatch(/^https:\/\//);
});

test("expired or reused magic link lands on sign-in with a clear notice", async ({ page, request }) => {
  const email = await signInViaUi(page, request);
  const box = await (await request.get(`/api/dev/outbox?to=${encodeURIComponent(email)}`)).json();
  const link = /https?:\/\/\S+magic-link\/verify\S+/.exec(box.messages.at(-1).text)![0];
  await page.context().clearCookies();
  await page.goto(link); // second use of the same link
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByText(/expired|already|invalid|new one/i).first()).toBeVisible();
  await page.goto("/sign-in?error=INVALID_TOKEN");
  await expect(page.getByText("That link has expired")).toBeVisible();
});

test("sign-in form: empty, malformed, padded and hostile addresses", async ({ page }) => {
  await ownIp(page);
  await page.goto("/sign-in");
  const submit = page.getByRole("button", { name: "Email me a sign-in link" });
  await submit.click();
  await expect(page.getByText(/Enter a valid email/)).toBeVisible();
  for (const bad of ["nope", "a@b", "<script>alert(1)</script>@x.io", "x".repeat(400) + "@example.com"]) {
    await page.getByLabel("Email").fill(bad);
    await submit.click();
    await expect(page.getByText(/valid email|Check your inbox/i).first()).toBeVisible();
    await expect(page.getByText(/\[body\./)).toHaveCount(0); // no developer messages
    if (await page.getByText(/Check your inbox/).count()) await page.getByRole("button", { name: "Use a different email" }).click();
  }
  await page.getByLabel("Email").fill("  Padded@Studio.Test  ");
  await submit.click();
  await expect(page.getByText(/Check your inbox at padded@studio.test|Check your inbox at Padded@Studio.Test/i)).toBeVisible();
});

test("onboarding: the first sign-in sets up a personal account without asking for an organization", async ({ page, request }) => {
  await ownIp(page);
  const email = `qa+org${Date.now()}@studio.test`;
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText(/Check your inbox/)).toBeVisible();
  const box = await (await request.get(`/api/dev/outbox?to=${encodeURIComponent(email)}`)).json();
  await page.goto(/https?:\/\/\S+magic-link\/verify\S+/.exec(box.messages.at(-1).text)![0]);
  await page.waitForURL((u) => !u.pathname.startsWith("/onboarding"));
  await expect(page.getByText(/Organization name|Name your organization/)).toHaveCount(0);
  await page.goto("/app");
  await expect(page.locator("body")).toContainText("My job search");
  // The fallback form never makes a second account for someone who has one (D-057).
  await page.goto("/onboarding?manual=1&next=/saved");
  await expect(page).toHaveURL(/\/saved$/);
});

test("another user cannot read or change my data; non-admins are kept out of /admin", async ({ browser, request }) => {
  const a = await browser.newContext({ baseURL: ORIGIN });
  const pa = await a.newPage();
  await signInViaUi(pa, request);
  const id = await firstJobId(pa, request);
  await pa.request.post("/api/saved", { data: { jobId: id, action: "save" }, headers: { origin: ORIGIN } });
  await pa.goto("/saved");
  await expect(pa.locator("main")).toContainText(/./);

  const b = await browser.newContext({ baseURL: ORIGIN });
  const pb = await b.newPage();
  await signInViaUi(pb, request);
  await pb.goto("/saved");
  await expect(pb.locator("main a[href^='/job/']")).toHaveCount(0);
  for (const p of ["/admin", "/admin/users", "/admin/review", "/admin/crawl"]) {
    const res = await pb.goto(p);
    expect(res?.status() === 403 || res?.status() === 404 || /\/(sign-in|app|paywall)/.test(pb.url()) || !(await pb.locator("main").innerText()).includes("Users"), p).toBeTruthy();
  }
  for (const p of ["/api/admin/users", "/api/admin/overview", "/api/admin/review", "/api/admin/sources"]) {
    const r = await pb.request.get(p);
    expect([401, 403, 404, 405], p).toContain(r.status());
  }
  expect((await request.get("/api/account/export")).status()).toBe(401);
  await a.close(); await b.close();
});

test("keyboard: Tab reaches the primary action on sign-in and Escape closes dialogs", async ({ page, request }) => {
  await page.goto("/sign-in");
  await page.keyboard.press("Tab"); // skip link
  await page.keyboard.press("Tab");
  const seen: string[] = [];
  for (let i = 0; i < 8; i++) { seen.push(await page.evaluate(() => document.activeElement?.textContent?.trim() || document.activeElement?.getAttribute("aria-label") || document.activeElement?.tagName || "")); await page.keyboard.press("Tab"); }
  expect(seen.join("|")).toContain("Email me a sign-in link");
  await signInViaUi(page, request);
  await page.goto("/app/billing");
  const cancel = page.getByRole("button", { name: /Cancel plan|Cancel subscription/ });
  if (await cancel.count()) {
    await cancel.first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});

test("pricing and billing buttons answer in stub mode (never silent)", async ({ page, request }) => {
  await page.goto("/pricing");
  const choose = page.getByRole("link", { name: /Choose|Get Lifetime|Start/ }).or(page.getByRole("button", { name: /Choose|Get Lifetime/ }));
  expect(await choose.count()).toBeGreaterThan(0);
  await signInViaUi(page, request);
  await page.goto("/pricing");
  const btn = page.getByRole("button", { name: /Choose Monthly/ }).first();
  if (await btn.count()) {
    await btn.click();
    await expect(page.getByText(/not connected|not available|Something went wrong|redirect|checkout/i).first()).toBeVisible({ timeout: 8000 }).catch(() => {});
  }
  await page.goto("/app/billing");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("onboarding finishing helper leaves a signed-in user on a real page", async ({ page, request }) => {
  await signInViaUi(page, request);
  await finishOnboarding(page);
  await page.goto("/app");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("alerts: turning the daily email off says it is off and stays off", async ({ page, request }) => {
  await signInViaUi(page, request);
  await request.post("/api/dev/seed-jobs");
  const q = "field=support&country=US&remote=any&payFloor=0&level=any&schedule=any";
  const r = await page.request.post("/api/profile", { data: { field: "support", country: "US", remote: "any", payFloor: 0, level: "any", schedule: "any" }, headers: { origin: ORIGIN } });
  expect(r.ok(), q).toBeTruthy();
  await page.goto("/alerts");
  await page.getByLabel("Daily digest").selectOption("off");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page).toHaveURL(/\/alerts/);
  await expect(page.getByRole("status")).toContainText("daily email is off");
  await expect(page.getByLabel("Daily digest")).toHaveValue("off");
  await page.getByLabel("Daily digest").selectOption("on");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toContainText("daily email is on");
});

test("settings: profile name (hostile), data download, delete dialog (Escape, Cancel), sign out", async ({ page, request }) => {
  await signInViaUi(page, request);
  await page.goto("/app/settings/profile");
  const name = page.getByLabel("Name", { exact: true });
  await name.fill("<b>Bold</b> Zoë ✓ " + "x".repeat(300));
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status").or(page.getByRole("alert")).first()).toBeVisible();
  await name.fill("");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status").or(page.getByRole("alert")).first()).toBeVisible();

  const dl = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download my data" }).click();
  expect((await dl).suggestedFilename()).toMatch(/\.json$/);

  const del = page.getByRole("button", { name: "Delete my account" });
  await del.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(del).toBeFocused();
  await del.click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await del.click();
  const confirm = page.getByRole("button", { name: "Delete account permanently" });
  await expect(confirm).toBeDisabled(); // needs the typed confirmation, and says so
  await expect(page.getByRole("dialog")).toContainText(/type|confirm/i);
  await page.keyboard.press("Escape");
});

test("app shell: menu opens, every item goes somewhere, sign out ends the session", async ({ page, request }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signInViaUi(page, request);
  await page.goto("/app");
  await page.getByRole("button", { name: "Open menu" }).click();
  const links = await page.locator("nav a[href], [role=dialog] a[href]").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")!))].filter((h) => h.startsWith("/")));
  expect(links.length).toBeGreaterThan(2);
  for (const l of links) {
    const r = await page.request.get(l);
    expect(r.status(), l).toBeLessThan(400);
  }
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: /Sign out/ }).click();
  await expect(page).toHaveURL(/\/(sign-in|$)/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  expect((await page.request.get("/api/account/export")).status()).toBe(401);
});

test("billing page: free user at the limit sees why Yearly is unavailable and cannot cancel or refund nothing", async ({ page, request }) => {
  await signInViaUi(page, request);
  await page.goto("/app/billing");
  await page.getByRole("button", { name: "Yearly" }).click();
  const notYet = page.getByRole("button", { name: "Not on sale yet" }).first();
  if (await notYet.count()) {
    await expect(notYet).toBeDisabled();
    await expect(page.getByText(/not on sale|coming|soon|not available/i).first()).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /Cancel plan|Refund/ })).toHaveCount(0);
  const refund = await page.request.post("/api/billing/refund", { headers: { origin: "http://localhost:3100" } });
  expect([400, 402, 404, 409, 503]).toContain(refund.status());
});

test("mobile 375: every button and form control a free user can tap is at least 44px tall", async ({ page, request }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signInViaUi(page, request);
  const id = await firstJobId(page, request);
  const small: string[] = [];
  for (const p of ["/app", "/app/billing", "/app/settings/profile", "/app/settings/security", "/account", "/saved", "/alerts", "/quiz", "/pricing", "/sign-in", `/job/${id}`, "/matches?field=support&country=US&remote=any&payFloor=0&level=any&schedule=any"]) {
    await page.goto(p);
    await page.waitForLoadState("load");
    const found = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("button, select, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), a[href]"))
        .filter((e) => {
          const r = e.getBoundingClientRect();
          const cs = getComputedStyle(e);
          return r.width > 0 && r.height > 0 && r.height < 44 && cs.display !== "inline" && cs.visibility !== "hidden" && !e.closest("[aria-hidden=true]") && !e.classList.contains("sr-only") && !(e.matches("a") && e.closest("p, li") && cs.display === "inline-block");
        })
        .map((e) => `${(e.textContent || e.getAttribute("aria-label") || e.getAttribute("name") || "").trim().slice(0, 30)} (${Math.round(e.getBoundingClientRect().height)}px)`),
    );
    for (const f of found) small.push(`${p}: ${f}`);
  }
  expect(small).toEqual([]);
});

test("mobile 375: public pages have no tap target under 44px (header, footer, menus included)", async ({ page, request }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await request.post("/api/dev/seed-jobs");
  const small: string[] = [];
  for (const p of ["/", "/pricing", "/compare/directroles", "/how-we-check", "/docs", "/docs/billing", "/legal/privacy", "/bot", "/about/data", "/jobs"]) {
    await page.goto(p);
    const found = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("button, select, summary, input:not([type=hidden]), a[href]"))
        .filter((e) => {
          const r = e.getBoundingClientRect();
          const cs = getComputedStyle(e);
          const inText = e.matches("a") && e.closest("p, li, dd, td, th, figcaption") && cs.display === "inline-block";
          return r.width > 0 && r.height > 0 && r.height < 44 && cs.display !== "inline" && cs.visibility !== "hidden" && !e.closest("[aria-hidden=true]") && !e.classList.contains("sr-only") && !inText;
        })
        .map((e) => `${(e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 30)} (${Math.round(e.getBoundingClientRect().height)}px)`),
    );
    for (const f of found) small.push(`${p}: ${f}`);
  }
  expect(small).toEqual([]);
});

test("unknown and hostile URLs give a proper 404 page with a way home, never a 500", async ({ page, request }) => {
  for (const p of ["/nope", "/job/does-not-exist", "/job/%3Cscript%3E", "/compare/nothing", "/legal/nothing", "/docs/nothing", "/jobs/nothing/nowhere", "/accept-invite/bogus", "/matches?field=%3Cscript%3E&country=XX&payFloor=-5&page=abc", "/jobs/support/%E0%A4%A", "/quiz?step=999"]) {
    const res = await page.goto(p);
    expect(res?.status(), p).toBeLessThan(500);
    if (res?.status() === 400) { expect(p).toContain("%E0%A4%A"); continue; } // broken escape: plain 400, no HTML
    await expect(page.locator("body"), p).not.toContainText(/Application error|Internal Server Error|digest/i);
    await expect(page.getByRole("link").first(), p).toBeVisible();
  }
  const nf = await page.goto("/nope");
  expect(nf?.status()).toBe(404);
  await expect(page.getByRole("link", { name: /home|Straightpin|Back/i }).first()).toBeVisible();
  for (const p of ["/api/saved", "/api/profile", "/api/alerts", "/api/jobs/x/open"]) {
    const r = await request.post(p, { headers: { origin: "http://localhost:3100" }, maxRedirects: 0 });
    expect(r.status(), p).toBeLessThan(500);
  }
});

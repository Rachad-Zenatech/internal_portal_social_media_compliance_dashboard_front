/** Local UI test: node tests/verifyPendingCheckPolling.cjs <submission-uuid>.
 * Uses the existing test-manager login and a completed post as a display fixture.
 * Blocks UI writes and makes no AI calls. Set PLAYWRIGHT_DRIVER_DIR if needed.
 */
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_DRIVER_DIR || path.join(require("node:os").tmpdir(), "compliance-poll-browser/playwright"));
const id = process.argv[2], api = "http://localhost:8009";
async function verify() {
  if (!/^[a-f0-9-]{36}$/i.test(id || "")) throw Error("Supply a local submission UUID.");
  const login = await fetch(api + "/api/auth/test-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ as: "manager" }) });
  if (!login.ok) throw Error("Enable the existing local test-manager login.");
  const { token } = await login.json();
  const response = await fetch(api + "/api/submissions/" + id, { headers: { Authorization: "Bearer " + token } });
  if (!response.ok) throw Error("The test manager cannot read that local post: " + response.status);
  const completed = await response.json();
  if (!completed.latest_check || completed.latest_check.analysis_pending) throw Error("Choose a post with a completed saved check.");
  completed.can_edit = true; // Display fixture only; server permissions remain unchanged.
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || "C:/Program Files/Google/Chrome/Application/chrome.exe" });
  try { for (const name of ["automatic", "failed polling", "long wait"]) await scenario(browser, token, completed, name); }
  finally { await browser.close(); }
}
async function scenario(browser, token, completed, name) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(t => sessionStorage.setItem("token", t), token);
  let reads = 0, fail = false, ready = false;
  const pending = structuredClone(completed);
  pending.latest_check = { ...pending.latest_check, analysis_pending: true, images_pending: 1,
    manual_requested_at: new Date(Date.now() - (name === "long wait" ? 240000 : 0)).toISOString() };
  await context.route("**/api/**", route => {
    if (route.request().method() !== "GET") return route.abort();
    if (new URL(route.request().url()).pathname !== "/api/submissions/" + id) return route.continue();
    reads++;
    if (fail && !ready) return route.fulfill({ status: 503, contentType: "application/json", body: '{"detail":"Test polling unavailable"}' });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ready ? completed : pending) });
  });
  try {
    const page = await context.newPage();
    await page.goto("http://localhost:5179/submissions/new?id=" + id + "&step=compliance");
    const spinner = page.getByText("Finishing compliance check", { exact: true });
    await spinner.waitFor({ timeout: 30000 });
    if (name === "failed polling") { fail = true; await page.getByText("We couldn't refresh this check", { exact: true }).waitFor({ timeout: 20000 }); }
    if (name === "long wait") await page.getByText("This check is taking longer than expected", { exact: true }).waitFor({ timeout: 15000 });
    ready = true;
    if (name !== "automatic") await page.getByRole("button", { name: "Refresh status", exact: true }).click();
    await spinner.waitFor({ state: "hidden", timeout: 25000 });
    await page.getByText(String(completed.latest_check.score), { exact: true }).first().waitFor({ timeout: 10000 });
    console.log(JSON.stringify({ scenario: name, reads, passed: true }));
  } finally { await context.close(); }
}
verify().catch(error => { console.error(error.message); process.exitCode = 1; });

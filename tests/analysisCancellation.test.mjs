import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./loadTypeScriptService.mjs";

test("stopping compliance aborts an active streamed request", async () => {
  const controller = new AbortController();
  let requestedSignal;
  const { submissionService } = loadService("submissionService", {
    "@/services/apiClient": { BASE_URL: "", apiClient: {} },
    "@/services/helper": {},
  }, "services", {
    sessionStorage: { getItem: () => null },
    fetch: (_url, options) => new Promise((_resolve, reject) => {
      requestedSignal = options.signal;
      options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
    }),
  });
  const running = submissionService.runCheckStream("post", () => assert.fail("Stopped checks cannot emit results"), false, controller.signal);
  controller.abort();
  await assert.rejects(running, { name: "AbortError" });
  assert.equal(requestedSignal, controller.signal);
});

test("stopping a script check prevents saving its late result and clears its running status", async () => {
  const controller = new AbortController();
  let finish;
  const stage = { precheck: { score: 95 } };
  const checks = loadService("backgroundScriptChecks", {
    "@/services/scriptService": { scriptService: { precheck: (_id, _confirmed, signal) => {
      assert.equal(signal, controller.signal);
      return new Promise((resolve) => { finish = resolve; });
    } } },
    "@/services/scriptBatchService": {},
  });
  const saved = [];
  const running = checks.runScriptCompliance("post", false, (value) => saved.push(value), controller.signal);
  await Promise.resolve();
  controller.abort();
  finish(stage);
  await assert.rejects(running, { name: "AbortError" });
  assert.deepEqual(saved, []);
  assert.equal(checks.pendingScriptChecks("script:post").length, 0);
});

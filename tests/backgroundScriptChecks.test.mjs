import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./loadTypeScriptService.mjs";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
function service(scriptService = {}, scriptBatchService = {}) {
  return loadService("backgroundScriptChecks", {
     "@/services/scriptService": { scriptService },
     "@/services/scriptBatchService": { scriptBatchService },
  });
}

test("single checks survive unsubscribing and reconnect without a duplicate request", async () => {
  const request = deferred(), saved = [];
  let calls = 0, notifications = 0;
  const app = service({ precheck: () => { calls++; return request.promise; } });
  const unsubscribe = app.subscribeScriptChecks(() => notifications++);
  const running = app.runScriptCompliance("post", false, (stage) => saved.push(stage));
  assert.deepEqual(Array.from(app.pendingScriptChecks("script:post")), ["post"]);
  unsubscribe(); // the page was closed
  await tick();
  const again = app.runScriptCompliance("post", false, () => assert.fail("duplicate check"));
  assert.equal(again, running);
  assert.equal(calls, 1);
  const stage = { precheck: { score: 95 } };
  request.resolve(stage);
  assert.equal(await running, stage);
  assert.equal(saved[0], stage); // query cache is updated even without a mounted page
  assert.equal(notifications, 1);
  assert.equal(app.pendingScriptChecks("script:post").length, 0);
});

test("all bulk scripts continue after navigation, two at a time, and retain progress and results", async () => {
  const ids = ["a", "b", "c", "d", "e", "f"];
  const requests = Object.fromEntries(ids.map((id) => [id, deferred()]));
  const called = [], saved = [];
  let active = 0, peak = 0;
  const app = service({}, { async checkItem(batchId, id) {
    assert.equal(batchId, "batch");
    called.push(id);
    active++;
    peak = Math.max(peak, active);
    try { return await requests[id].promise; }
    finally { active--; }
  } });
  const unsubscribe = app.subscribeScriptChecks(() => {});
  const running = app.runBatchScriptCompliance("batch", ids, (batch) => saved.push(batch));
  await tick();
  assert.deepEqual(called, ["a", "b"]);
  unsubscribe(); // no component owns the remaining queue
  const again = app.runBatchScriptCompliance("batch", ids, () => assert.fail("duplicate batch"));
  assert.equal(again, running);
  for (const id of ids) {
    assert.ok(called.includes(id));
    requests[id].resolve({ id: "batch", completed: id });
    await tick();
    assert.ok(!app.pendingScriptChecks("batch:batch").includes(id));
  }
  await running;
  assert.equal(peak, 2);
  assert.deepEqual(called, ids);
  assert.deepEqual(saved.map((batch) => batch.completed), ids);
  assert.equal(app.pendingScriptChecks("batch:batch").length, 0);
});

test("a failed bulk script reports an error after the other queued scripts finish", async () => {
  const checked = [], saved = [];
  const app = service({}, { async checkItem(_batch, id) {
    checked.push(id);
    if (id === "bad") throw new Error("Failed to read script");
    return { id };
  } });
  await assert.rejects(app.runBatchScriptCompliance("batch", ["ok", "bad", "last"], (batch) => saved.push(batch.id)), /1 script check/);
  assert.deepEqual(checked, ["ok", "bad", "last"]);
  assert.deepEqual(saved, ["ok", "last"]);
  assert.equal(app.pendingScriptChecks("batch:batch").length, 0);
});

test("a failed single check releases its status so it can be retried manually", async () => {
  let calls = 0;
  const stage = { precheck: { score: 100 } };
  const app = service({ async precheck() {
    if (++calls === 1) throw new Error("Temporarily unavailable");
    return stage;
  } });
  await assert.rejects(app.runScriptCompliance("post", false, () => {}));
  assert.equal(app.pendingScriptChecks("script:post").length, 0);
  assert.equal(await app.runScriptCompliance("post", false, () => {}), stage);
  assert.equal(calls, 2);
});

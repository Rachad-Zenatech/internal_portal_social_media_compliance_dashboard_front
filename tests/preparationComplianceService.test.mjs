import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./loadTypeScriptService.mjs";

function setup({ failure, precheck = { score: 95 } } = {}) {
  const calls = [], stages = [], attempts = [];
  const stage = { status: "DRAFT", precheck };
  const draft = { id: "script-draft", caption_text: null, files: [], latest_check: { score: 42 } };
  const { scriptService } = loadService("scriptService", {
     "@/services/apiClient": { apiClient: { async post(path, body) {
       calls.push(["post", path, body.confirm_repost]);
       if (failure) throw failure;
       return stage;
     } } },
  });
  const submissionService = {
    async get(id) { calls.push(["get", id]); return draft; },
    async runCheckStream(id, onAttempt, confirmed) {
      calls.push(["stream", id, confirmed]);
      onAttempt({ id: "model-attempt" });
      return draft;
    },
  };
  const background = loadService("backgroundScriptChecks", {
     "@/services/scriptService": { scriptService },
     "@/services/scriptBatchService": { scriptBatchService: {} },
  });
  const { runPreparationCompliance } = loadService("preparationComplianceService", {
     "@/services/backgroundScriptChecks": background,
     "@/services/submissionService": { submissionService },
  });
  const run = (script, confirmed = false, signal) => runPreparationCompliance(
    draft.id, script, (attempt) => attempts.push(attempt), (value) => stages.push(value), confirmed, signal,
  );
  return { run, calls, stages, stage, draft, attempts };
}

test("a script without video, caption or approval uses the script endpoint and its saved check", async () => {
  const app = setup();
  const result = await app.run(true);
  assert.deepEqual(app.calls, [
    ["post", "/api/submissions/script-draft/script/precheck", false], ["get", "script-draft"],
  ]);
  assert.equal(result.latest_check, app.stage.precheck);
  assert.equal(result.caption_text, null);
  assert.equal(app.stages[0], app.stage);
  assert.deepEqual(app.attempts, []);
});

test("finished posts keep the streamed post check", async () => {
  const app = setup();
  assert.equal(await app.run(false, true), app.draft);
  assert.deepEqual(app.calls, [["stream", "script-draft", true]]);
  assert.equal(app.attempts.length, 1);
  assert.deepEqual(app.stages, []);
});

test("a script check forwards repost confirmation", async () => {
  const app = setup();
  await app.run(true, true);
  assert.deepEqual(app.calls[0], ["post", "/api/submissions/script-draft/script/precheck", true]);
});

test("a script error is preserved without falling back to finished-post validation", async () => {
  const failure = new Error("Script text is still being read");
  const app = setup({ failure });
  await assert.rejects(app.run(true), (error) => error === failure);
  assert.equal(app.calls.length, 1);
  assert.deepEqual(app.stages, []);
});

test("an absent script result never displays an old finished-post score", async () => {
  const app = setup({ precheck: null });
  assert.equal((await app.run(true)).latest_check, null);
});

test("stopping before a check starts prevents both script and finished-post requests", async () => {
  for (const script of [true, false]) {
    const app = setup();
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(app.run(script, false, controller.signal), { name: "AbortError" });
    assert.equal(app.calls.length, 0);
  }
});

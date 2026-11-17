import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./loadTypeScriptService.mjs";

const { visibleScripts, scriptReviewCounts } = loadService("scriptReviewLists", {}, "lib");
const approved = (id, batch_id = null) => ({ id, script_status: "APPROVED", batch_id });
const batch = (id, status) => ({ id, status });

test("an approved individually uploaded script appears in the Approved count", () => {
  const counts = scriptReviewCounts([], [approved("single")]);
  assert.equal(counts.done, 1);
  assert.equal(counts.review, 0);
});

test("badges count both batches and standalone scripts", () => {
  const counts = scriptReviewCounts([batch("bulk", "IN_REVIEW")], [
    { id: "inside", script_status: "IN_REVIEW", batch_id: "bulk" },
    { id: "single", script_status: "IN_REVIEW", batch_id: null }, approved("approved"),
  ]);
  assert.equal(counts.review, 2);
  assert.equal(counts.done, 1);
});

test("an approved script remains visible while the rest of its batch is in review", () => {
  const batches = [batch("bulk", "IN_REVIEW")];
  const script = approved("approved", "bulk");
  assert.equal(scriptReviewCounts(batches, [script]).done, 1);
  assert.deepEqual(visibleScripts([script], []), [script]);
});

test("a fully approved batch is shown and counted once without duplicate individual cards", () => {
  const batches = [batch("bulk", "DONE")];
  const scripts = [approved("one", "bulk"), approved("two", "bulk")];
  assert.equal(scriptReviewCounts(batches, scripts).done, 1);
  assert.equal(visibleScripts(scripts, batches).length, 0);
});

test("sent-back members of a partly reviewed batch are visible in Sent back", () => {
  const counts = scriptReviewCounts([batch("bulk", "IN_REVIEW")], [
    { id: "changes", script_status: "CHANGES_REQUESTED", batch_id: "bulk" },
    { id: "edited", script_status: "EDITS_PROPOSED", batch_id: "bulk" },
  ]);
  assert.equal(counts.sent_back, 2);
});

test("a script in a batch the viewer cannot see is still represented individually", () => {
  assert.equal(visibleScripts([approved("one", "other-batch")], []).length, 1);
});

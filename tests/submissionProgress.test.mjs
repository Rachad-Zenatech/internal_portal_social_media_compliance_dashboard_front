import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./loadTypeScriptService.mjs";

const postSteps = loadService("postSteps", {}, "lib");
const { creatorSubmissionSteps, creatorProgressText } = loadService("submissionProgress", {
   "@/lib/postSteps": postSteps,
}, "lib");

function script(over = {}) {
  return {
    content_type: "VIDEO", status: "DRAFT", script_status: "DRAFT", has_script: true,
    steps: {
      details: "todo", compliance: "done", sentiment: "todo", mood: "todo", send: "todo",
      locked: false, ready_to_send: false, next: "details",
      missing: ["main_file", "caption", "script_approval"],
    },
    ...over,
  };
}
function displayed(row) { return { ...row, steps: creatorSubmissionSteps(row) }; }

test("bulk scripts in review show three checkmarks, matching counts, and no next incomplete step", () => {
  for (const score of [100, 90, 82, 77]) {
    const row = displayed(script({ script_status: "IN_REVIEW", latest_score: score }));
    for (const key of ["details", "compliance", "send"]) assert.equal(row.steps[key], "done");
    assert.equal(row.steps.locked, true);
    assert.equal(row.steps.next, null);
    assert.equal(row.steps.missing.length, 0);
    assert.match(creatorProgressText(row, "Draft"), /^3 of 3 steps complete .*Sent for review$/);
  }
});

test("a filled script draft completes details without video, caption, or approval", () => {
  const row = displayed(script());
  assert.equal(row.steps.details, "done");
  assert.equal(row.steps.compliance, "done");
  assert.equal(row.steps.send, "todo");
  assert.equal(row.steps.next, "send");
  assert.equal(row.steps.ready_to_send, true);
  assert.equal(row.steps.locked, false);
  assert.equal(row.steps.missing.length, 0);
  assert.equal(creatorProgressText(row, "Draft"), "Ready to send");
});

test("a script not checked yet has only details checked and resumes at compliance", () => {
  const row = script();
  row.steps.compliance = "todo";
  const current = displayed(row);
  assert.equal(current.steps.details, "done");
  assert.equal(current.steps.next, "compliance");
  assert.equal(creatorProgressText(current, "Draft"), "1 of 3 steps done");
});

test("missing script metadata keeps the details step incomplete", () => {
  const row = script();
  row.steps.missing.push("rule_sets", "account_id");
  const current = displayed(row);
  assert.equal(current.steps.details, "todo");
  assert.equal(current.steps.next, "details");
  assert.deepEqual(Array.from(current.steps.missing), ["rule_sets", "account_id"]);
});

test("a draft without a script still requires one", () => {
  const row = displayed(script({ has_script: false }));
  assert.equal(row.steps.details, "todo");
  assert.equal(row.steps.next, "details");
  assert.deepEqual(Array.from(row.steps.missing), ["script"]);
});

test("older summaries can prove the attached script through its extracted preview", () => {
  const row = displayed(script({ has_script: undefined, script_excerpt: "Storyline: construction inspection" }));
  assert.equal(row.steps.details, "done");
  const empty = displayed(script({ has_script: undefined, script_excerpt: "  " }));
  assert.equal(empty.steps.details, "todo");
});

test("actual videos keep video and caption requirements and the sentiment step", () => {
  const row = displayed(script({ cover: { mime_type: "video/mp4" }, script_status: "APPROVED" }));
  assert.equal(row.steps.details, "todo");
  assert.ok(row.steps.missing.includes("caption"));
  assert.ok(row.steps.missing.includes("main_file"));
  assert.equal(creatorProgressText(row, "Draft"), "1 of 4 steps done");
});

test("ordinary post details are not completed while required fields are missing", () => {
  const row = displayed(script({ content_type: "IMAGE", script_status: null }));
  assert.equal(row.steps.details, "todo");
  assert.equal(row.steps.next, "details");
});

test("display normalization preserves the server response without mutating its steps", () => {
  const row = script();
  const before = JSON.stringify(row);
  creatorSubmissionSteps(row);
  assert.equal(JSON.stringify(row), before);
});

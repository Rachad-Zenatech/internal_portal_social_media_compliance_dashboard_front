import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { incomingCaptionChanges, incomingPostTextChanges } from "../src/lib/creatorReviewUpdates.ts";

const edit = (id, before, after, extra = {}) => ({ id, before, after, version: 3, platform: null, actor_name: `Reviewer ${id}`, ...extra });
test("incoming comparison spans all reviewers in this round and keeps platforms separate", () => {
  const result = incomingCaptionChanges([edit(2, "middle", "final"), edit(1, "original", "middle"), edit(3, "old", "irrelevant", { version: 2 }), edit(4, "fb old", "fb new", { platform: "FACEBOOK" })], 3);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], { key: "main", label: "Main caption", before: "original", after: "final", authors: ["Reviewer 1", "Reviewer 2"] });
  assert.equal(result[1].before, "fb old");
});
test("no edits returns no fabricated suggestions", () => {
  assert.deepEqual(incomingCaptionChanges([], 3), []);
  assert.deepEqual(incomingPostTextChanges([], 3), []);
});
test("text-only posts retain original, final text and each editor", () => {
  const edits = [ { id: "2", version: 2, before_text: "middle", after_text: "final", reviewer_name: "B", created_at: "2026-11-26T11:00:00Z" },
    { id: "1", version: 2, before_text: "original", after_text: "middle", reviewer_name: "A", created_at: "2026-11-26T10:00:00Z" } ];
  const [change] = incomingPostTextChanges(edits, 2);
  assert.equal(change.before, "original"); assert.equal(change.after, "final"); assert.deepEqual(change.authors, ["A", "B"]);
});
test("reviewer controls expose one approval action and no separate publishing action", () => {
  const panel = readFileSync(new URL("../src/components/submissions/ReviewDecisionPanel.tsx", import.meta.url), "utf8");
  const bar = readFileSync(new URL("../src/components/submissions/ReviewDecisionBar.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(panel + bar, /changes_publish|Send back &amp; allow publishing|Make changes &amp; publish/);
  assert.match(panel, /decision: "APPROVE"[^\n]*publish_after_changes: true/);
  assert.match(bar, /Request changes/); assert.match(bar, /Approve content/);
});

test("manual review reminders are a list without checkboxes or an approval gate", () => {
  const panel = readFileSync(new URL("../src/components/submissions/ReviewDecisionPanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /aria-label="Review reminders"/);
  assert.match(panel, /<ul className="space-y-1.5">/);
  assert.doesNotMatch(panel, /type="checkbox"|allConfirmed|confirmedRules|confirmed_rules:/);
});

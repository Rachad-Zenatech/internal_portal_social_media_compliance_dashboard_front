import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { incomingCaptionChanges, incomingPostTextChanges } from "../src/lib/creatorReviewUpdates.ts";

const edit = (id, before, after, extra = {}) => ({ id, before, after, version: 3, platform: null, actor_name: `Reviewer ${id}`, ...extra });
test("incoming comparison spans all reviewers in this round and keeps platforms separate", () => {
  const result = incomingCaptionChanges([edit(2, "middle", "final"), edit(1, "original", "middle"), edit(3, "old", "irrelevant", { version: 2 }), edit(4, "fb old", "fb new", { platform: "FACEBOOK" })], 3);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], { key: "main", label: "Main text", before: "original", after: "final", authors: ["Reviewer 1", "Reviewer 2"] });
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
  assert.match(panel, /decision: "APPROVE"[^\n]*publish_after_changes: openComments > 0/);
  assert.match(bar, /Request changes/); assert.match(bar, /Approve content/);
});

test("manual review reminders are a list without checkboxes or an approval gate", () => {
  const panel = readFileSync(new URL("../src/components/submissions/ReviewDecisionPanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /aria-label="Review reminders"/);
  assert.match(panel, /<ul className="space-y-1.5">/);
  assert.doesNotMatch(panel, /type="checkbox"|allConfirmed|confirmedRules|confirmed_rules:/);
});


test("caption comparisons retain the first original and final reviewer HTML for the current round", () => {
  const [change] = incomingCaptionChanges([
    edit(1, "Original", "Middle", { before_html: "<p><strong>Original</strong></p>", after_html: "<p>Middle</p>" }),
    edit(2, "Middle", "Final", { before_html: "<p>Middle</p>", after_html: '<p><a href="https://example.com">Final</a></p>' }),
    edit(3, "Old round", "Ignore", { version: 2 }),
  ], 3);
  assert.equal(change.beforeHtml, "<p><strong>Original</strong></p>");
  assert.equal(change.afterHtml, '<p><a href="https://example.com">Final</a></p>');
  assert.deepEqual(change.authors, ["Reviewer 1", "Reviewer 2"]);
});

test("text-post comparisons preserve original and incoming formatting independently of creator edits", () => {
  const edits = [
    { id: "2", version: 2, before_text: "Middle", after_text: "Incoming", before_html: "<p>Middle</p>", after_html: "<p><em>Incoming</em></p>", reviewer_name: "B", created_at: "2026-11-26T11:00:00Z" },
    { id: "1", version: 2, before_text: "Original", after_text: "Middle", before_html: "<p><b>Original</b></p>", after_html: "<p>Middle</p>", reviewer_name: "A", created_at: "2026-11-26T10:00:00Z" },
  ];
  const original = JSON.stringify(edits);
  const [change] = incomingPostTextChanges(edits, 2);
  assert.equal(change.beforeHtml, "<p><b>Original</b></p>");
  assert.equal(change.afterHtml, "<p><em>Incoming</em></p>");
  assert.equal(JSON.stringify(edits), original);
});

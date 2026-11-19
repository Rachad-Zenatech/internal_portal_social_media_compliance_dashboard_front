import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./loadTypeScriptService.mjs";
const { coverageOf, visibleRuleResults } = loadService("ruleCoverage", {}, "lib");
const row = (id, complete, outcome = null) => ({ rule_id: id, rule_number: `Rule ${id}`, title: "Rule", complete, outcome, reason: "A specific reason.", methods: [] });

test("missing applicable rows never count as evaluated", () => {
  const value = coverageOf({ rules_checked: 3, rule_results_version: "v1", rule_results: [row("1", true, "NO_ISSUE_FOUND")] });
  assert.equal(value.complete, 1); assert.equal(value.incomplete, 2); assert.equal(value.missing, 2);
});

test("incomplete judgments stay visible and sort before completed clean checks", () => {
  const rows = [row("1", true, "NO_ISSUE_FOUND"), row("2", false), row("3", false, "ISSUE")];
  const original = JSON.stringify(rows);
  const value = coverageOf({ rule_results_version: "v1", rule_results: rows });
  assert.equal(value.rows[0].complete, false); assert.equal(value.complete, 1);
  assert.equal(visibleRuleResults(value.rows, "INCOMPLETE").length, 2);
  assert.equal(visibleRuleResults(value.rows, "ISSUE").length, 1);
  assert.equal(JSON.stringify(rows), original);
});

test("a deliberate human-review result is not labelled an automatic clean pass", () => {
  const value = coverageOf({ rule_results_version: "v1", rule_results: [row("1", true, "HUMAN_REVIEW_REQUIRED")] });
  assert.equal(value.complete, 1);
  assert.equal(value.attention, 1);
  assert.equal(visibleRuleResults(value.rows, "NO_ISSUE_FOUND").length, 0);
  assert.equal(visibleRuleResults(value.rows, "HUMAN_REVIEW_REQUIRED").length, 1);
});

test("old checks report unknown coverage instead of inferring it from manual-rule counts", () => {
  const value = coverageOf({ rules_checked: 31 });
  assert.equal(value.legacy, true); assert.equal(value.complete, 0); assert.equal(value.incomplete, 31);
});

test("an empty scoped result is distinguishable from an old check", () => {
  const value = coverageOf({ rules_checked: 0, rule_results_version: "v1", rule_results: [] });
  assert.equal(value.legacy, false); assert.equal(value.total, 0);
});

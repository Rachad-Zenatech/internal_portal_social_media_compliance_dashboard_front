import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./loadTypeScriptService.mjs";
const evidence = loadService("findingEvidence", {}, "lib");
const { reviewerFindingSelection: select } = loadService("reviewerFindingSelection", { "@/lib/findingEvidence": evidence }, "lib");
const flags = [{ v: { rule_id: "18", passage: "First claim" } }, { v: { rule_id: "18", passage: "Second claim" } }, { v: { rule_id: "4", passage: "Other flag" } }].map(flag => ({ v: { ...flag.v, flagged_terms: [flag.v.passage] } }));

test("reviewer preview has no automatic highlights", () => {
  assert.equal(select(flags, null, null, new Set()).terms.length, 0);
});

test("clicking a claim selects only that claim even when its rule is shared", () => {
  const result = select(flags, "18", { ...flags[1].v }, new Set());
  assert.equal(result.selectedFlags.length, 1);
  assert.equal(result.selectedFlags[0], flags[1]);
  assert.equal(result.terms[0].term, "Second claim");
});

test("changing the selected rule removes the previous highlight and retains dismissal status", () => {
  const result = select(flags, "4", null, new Set(["4"]));
  assert.equal(result.terms.length, 1);
  assert.equal(result.terms[0].term, "Other flag");
  assert.equal(result.terms[0].dismissed, true);
});

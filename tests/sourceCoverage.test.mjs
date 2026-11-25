import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./loadTypeScriptService.mjs";

const { withSourceCoverage, sourceCoverageCounts } = loadService("sourceCoverage", {}, "lib");
const source = (title, verdict, claim = "The battery lasts 10 hours") => ({ title, reference: title, status: "READ", claims: [{ claim, where: "image", verdict }] });

test("another source can cover an omission without changing the original source verdict", () => {
  const result = withSourceCoverage([source("Specification", "SUPPORTED"), source("Announcement", "NOT_FOUND")]);
  assert.equal(result[1].claims[0].verdict, "NOT_FOUND");
  assert.equal(result[1].claims[0].covered_by, "Specification");
  assert.equal(withSourceCoverage([result[1]])[0].claims[0].covered_by, undefined);
});

test("support does not hide contradictions, changed numbers or broader assertions", () => {
  const result = withSourceCoverage([source("Specification", "SUPPORTED"), source("Conflict", "CONTRADICTED"), source("Longer", "NOT_FOUND", "The battery lasts 20 hours")]);
  assert.equal(result[1].claims[0].covered_by, undefined);
  assert.equal(result[2].claims[0].covered_by, undefined);
});


test("covered omissions do not remain in review counts", () => {
  const result = withSourceCoverage([source("Army eligibility announcement", "SUPPORTED"), source("Indiana expansion", "NOT_FOUND")]);
  const counts = sourceCoverageCounts(result[1].claims);
  assert.equal(counts.open, 0);
  assert.equal(counts.covered, 1);
  assert.equal(counts.ok, 0); // This article did not establish the claim itself.
});

test("formatting-only differences match but an additional image assertion stays separate", () => {
  const result = withSourceCoverage([
    source("Army", "SUPPORTED", "ZERO contracts needed: no prior contract; no federal relationship"),
    source("Indiana", "NOT_FOUND", "Zero contracts needed no prior contract no federal relationship"),
    source("Broader", "NOT_FOUND", "Zero contracts needed no prior contract no federal relationship NO PROGRAM OF RECORD"),
    source("Negation", "NOT_FOUND", "Zero contracts are not needed"),
  ]);
  assert.equal(result[1].claims[0].covered_by, "Army");
  assert.equal(result[2].claims[0].covered_by, undefined);
  assert.equal(result[3].claims[0].covered_by, undefined);
});

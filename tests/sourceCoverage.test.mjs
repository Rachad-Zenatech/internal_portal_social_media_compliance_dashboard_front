import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./loadTypeScriptService.mjs";

const { withSourceCoverage } = loadService("sourceCoverage", {}, "lib");
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

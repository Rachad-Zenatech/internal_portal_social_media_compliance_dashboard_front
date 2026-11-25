import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./loadTypeScriptService.mjs";

const coverage = loadService("sourceCoverage", {}, "lib");
const visibility = loadService("sourceCheckVisibility", {}, "lib");
const { sourceClaimGroups } = loadService("sourceClaimGroups", {
  "@/lib/sourceCoverage": coverage, "@/lib/sourceCheckVisibility": visibility,
}, "lib");
const claim = (text, verdict = "NOT_FOUND", where = "caption") => ({ claim: text, verdict, where, confidence: .9 });
const source = (claims, extra = {}) => ({ reference: "Article", kind: "URL", where: "source_links", status: "READ", claims, ...extra });

test("source rows contain only matches or contradictions, without changing input", () => {
  const original = [source([claim("A", "SUPPORTED"), claim("B", "CONTRADICTED"), claim("C"), claim("D", "UNCLEAR")])];
  const result = sourceClaimGroups(original);
  assert.equal(result.sources[0].claims.length, 2);
  assert.equal(result.unmatched.length, 2);
  assert.equal(original[0].claims.length, 4);
});

test("unmatched list excludes assertions connected to any readable source", () => {
  const result = sourceClaimGroups([
    source([claim("Portable cooling", "SUPPORTED"), claim("Load 10 kg", "CONTRADICTED")]),
    source([claim("Portable cooling", "NOT_FOUND", "image"), claim("Load 10 kg"), claim("Load 20 kg")]),
  ]);
  assert.equal(result.unmatched.length, 1);
  assert.equal(result.unmatched[0].claim, "Load 20 kg");
  assert.equal(result.sources[0].claims[1].verdict, "CONTRADICTED");
});

test("deduplicates omissions across articles and media while retaining locations", () => {
  const result = sourceClaimGroups([
    source([claim("No prior contract; no federal relationship")]),
    source([claim("No prior contract no federal relationship", "UNCLEAR", "image")]),
    source([claim("No prior contract no federal relationship")]),
  ]);
  assert.equal(result.unmatched.length, 1);
  assert.equal(result.unmatched[0].locations.length, 2);
});

test("unreadable sources cannot resolve a claim and remain visible", () => {
  const result = sourceClaimGroups([source([claim("Capability", "SUPPORTED")], { status: "UNREADABLE", message: "PDF unavailable" }), source([claim("Capability")])]);
  assert.equal(result.unmatched.length, 1);
  assert.equal(result.sources[0].status, "UNREADABLE");
  assert.equal(result.sources[0].claims.length, 0);
});

test("unmatched automatic checks are retained in the claim tab", () => {
  const result = sourceClaimGroups([source([claim("Capability")], { where: "newsroom" })]);
  assert.equal(result.sources.length, 0);
  assert.equal(result.unmatched.length, 1);
});

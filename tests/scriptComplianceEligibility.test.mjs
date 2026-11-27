import assert from "node:assert/strict";
import test from "node:test";
import { hasCurrentScriptCheck } from "../src/lib/scriptComplianceEligibility.ts";

const saved = (overrides = {}) => ({
  latest_check: { score: 82, checked_script_sources: "Source A" },
  compliance_stale: false,
  sources_text: "Source A",
  ...overrides,
});

test("reuse a completed check even when its score fails compliance", () => {
  assert.equal(hasCurrentScriptCheck(saved()), true);
  assert.equal(hasCurrentScriptCheck(saved({ latest_check: { score: 0, checked_script_sources: "Source A" } })), true);
});

test("edits to details, script or sources require a fresh check", () => {
  assert.equal(hasCurrentScriptCheck(saved({ compliance_stale: true })), false);
  assert.equal(hasCurrentScriptCheck(saved({ sources_text: "Source B" })), false);
  assert.equal(hasCurrentScriptCheck(saved({ sources_text: "" })), false);
});

test("missing, incomplete and unavailable checks remain retryable", () => {
  assert.equal(hasCurrentScriptCheck(saved({ latest_check: null })), false);
  assert.equal(hasCurrentScriptCheck(saved({ latest_check: { score: null } })), false);
  assert.equal(hasCurrentScriptCheck(saved({ latest_check: { score: 100, ai_unavailable: true } })), false);
  assert.equal(hasCurrentScriptCheck(saved({ compliance_stale: undefined })), false);
});

test("a stale stored result cannot suppress a check", () => {
  assert.equal(hasCurrentScriptCheck(saved({ latest_check: { score: 82, checked_script_sources: "Source A", script_check_stale: true } })), false);
  assert.equal(hasCurrentScriptCheck(saved({ sources_text: " Source A\n" })), true);
});

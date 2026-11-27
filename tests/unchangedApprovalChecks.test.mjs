import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./loadTypeScriptService.mjs";
const media = loadService("mediaFreshness", {}, "lib");
const { preparationCheckState } = loadService("preparationFreshness", { "./mediaFreshness": media }, "lib");
const unchanged = { hasCheck: true, inputCheckStale: false, checkedAt: "2026-11-26T17:13:41.321Z", contentEditedAt: "2026-11-23T20:13:54Z", mediaEditedAt: "2026-11-20T20:13:08Z", mediaChanged: false, hasMood: false, sentiment: { status: "COMPLETED", is_current: true, created_at: "2026-11-24T15:45:42Z" } };

test("unchanged approved content reuses checks from before the decision", () => {
  const state = preparationCheckState(unchanged);
  assert.equal(state.compliance, true);
  assert.equal(state.sentiment, true);
});

test("new text or sources invalidate checks and fresh results restore readiness", () => {
  const changed = { ...unchanged, contentEditedAt: "2026-11-26T18:00:00Z" };
  assert.equal(preparationCheckState(changed).compliance, false);
  assert.equal(preparationCheckState(changed).sentiment, false);
  const refreshed = preparationCheckState({ ...changed, checkedAt: "2026-11-26T18:02:00Z", sentiment: { ...unchanged.sentiment, created_at: "2026-11-26T18:02:00Z" } });
  assert.equal(refreshed.compliance, true);
  assert.equal(refreshed.sentiment, true);
});

test("changed media, missing results, and incomplete checks still block readiness", () => {
  assert.equal(preparationCheckState({ ...unchanged, inputCheckStale: true }).compliance, false);
  assert.equal(preparationCheckState({ ...unchanged, hasCheck: false }).compliance, false);
  assert.equal(preparationCheckState({ ...unchanged, mediaChanged: true }).sentiment, false);
  assert.equal(preparationCheckState({ ...unchanged, sentiment: { ...unchanged.sentiment, status: "FAILED" } }).sentiment, false);
});

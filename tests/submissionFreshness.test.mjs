import assert from "node:assert/strict";
import test from "node:test";
import { checkIsCurrent, analysisIsCurrent } from "../src/lib/mediaFreshness.ts";

test("SUB-1219's saved compliance marker matches the API's ISO timestamp", () => {
  assert.equal(checkIsCurrent({ checked_media_edited_at: "2026-11-25 18:56:33.172250+00:00" }, "2026-11-25T18:56:33.172250Z"), true);
});
test("a completed analysis after the content revision remains current", () => {
  assert.equal(analysisIsCurrent("2026-11-25T18:56:44.186874Z", "2026-11-25T18:56:33.172250Z"), true);
});
test("a hash-validated cached analysis remains usable even though its original run is older", () => {
  assert.equal(analysisIsCurrent("2026-11-25T18:56:09.876379Z", "2026-11-25T18:56:33.172250Z", "2026-11-25T18:56:33.172250Z"), true);
});
test("editing content after cache validation invalidates the saved result", () => {
  assert.equal(analysisIsCurrent("2026-11-25T18:56:09.876379Z", "2026-11-25T18:57:00Z", "2026-11-25T18:56:33.172250Z"), false);
});
test("an older result without explicit validation still requires a check", () => {
  assert.equal(analysisIsCurrent("2026-11-25T18:56:09.876379Z", "2026-11-25T18:56:33.172250Z"), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./loadTypeScriptService.mjs";

const { mediaKey, mediaChanged, checkIsCurrent, analysisIsCurrent } = loadService("mediaFreshness", {}, "lib");
const { ranOnce } = loadService("postSteps", {}, "lib");
const before = "2026-11-18T12:00:00Z";
const after = "2026-11-18T13:00:00Z";
const file = (id, kind = "MAIN", extra = {}) => ({ id, kind, ...extra });

test("detail edits, extraction updates and supporting files preserve the media identity", () => {
  const original = [file("video"), file("script", "SCRIPT")];
  const files = [file("script", "SCRIPT"), file("video", "MAIN", { transcript_status: "COMPLETED" }), file("evidence", "SUPPORTING")];
  assert.equal(mediaKey(original), mediaKey(files));
  assert.equal(mediaChanged(files, { files: original, title: "Renamed", caption_text: "Updated" }), false);
});

test("replacing, removing or adding actual media changes its identity", () => {
  const saved = { files: [file("video"), file("script", "SCRIPT")] };
  for (const files of [[file("replacement"), file("script", "SCRIPT")], [file("video")], [...saved.files, file("image", "IMAGE")]]) {
    assert.equal(mediaChanged(files, saved), true);
  }
});

test("existing checks survive details edited after the check", () => {
  assert.equal(checkIsCurrent({ checked_at: after }, before), true);
  assert.equal(checkIsCurrent({ checked_at: before }, after), false);
});

test("media snapshot rejects replacements during a running check", () => {
  assert.equal(checkIsCurrent({ checked_at: after, checked_media_edited_at: before }, after), false);
  assert.equal(checkIsCurrent({ checked_media_edited_at: before }, "2026-11-18T12:00:00+00:00"), true);
  assert.equal(checkIsCurrent({ checked_media_edited_at: null }, null), true);
  assert.equal(checkIsCurrent({ checked_media_edited_at: null }, before), false);
});

test("sentiment stays current only while its media is unchanged", () => {
  assert.equal(analysisIsCurrent(after, before), true);
  assert.equal(analysisIsCurrent(before, after), false);
  assert.equal(analysisIsCurrent(null, null), false);
});

test("progress dots keep stale media checks incomplete", () => {
  const steps = { details: "done", compliance: "stale", sentiment: "done", mood: "done", send: "todo", locked: false };
  const result = ranOnce(steps);
  assert.equal(result.compliance, "stale");
  assert.equal(result.next, "compliance");
  assert.equal(result.ready_to_send, false);
});

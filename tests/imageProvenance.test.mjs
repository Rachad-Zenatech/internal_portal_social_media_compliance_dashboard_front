import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./loadTypeScriptService.mjs";
const { hasPostImages, imageProvenanceAnswer, imageProvenancePayload } = loadService("imageProvenance", {}, "lib");

test("unanswered defaults do not silently become No", () => {
  assert.equal(imageProvenanceAnswer({ ai_generated_images: false, ai_generated_images_confirmed: false }), null);
  assert.equal(imageProvenanceAnswer({}), null);
  assert.equal(Object.keys(imageProvenancePayload(null)).length, 0);
});

test("explicit Yes and No both survive saving and reloading", () => {
  for (const answer of [false, true]) {
    assert.equal(imageProvenancePayload(answer).ai_generated_images, answer);
    assert.equal(imageProvenanceAnswer({ ai_generated_images: answer, ai_generated_images_confirmed: true }), answer);
  }
});

test("an earlier checked AI-image answer is preserved", () => {
  assert.equal(imageProvenanceAnswer({ ai_generated_images: true }), true);
});

test("only actual post images require an answer", () => {
  assert.equal(hasPostImages([{ kind: "MAIN", mime_type: "image/jpeg" }]), true);
  assert.equal(hasPostImages([{ kind: "IMAGE", mime_type: "image/png" }]), true);
  assert.equal(hasPostImages([{ kind: "SUPPORTING", mime_type: "image/jpeg" }]), false);
  assert.equal(hasPostImages([{ kind: "MAIN", mime_type: "video/mp4" }]), false);
  assert.equal(hasPostImages([{ kind: "SCRIPT", mime_type: "application/pdf" }]), false);
  assert.equal(hasPostImages([]), false);
});

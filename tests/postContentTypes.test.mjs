import assert from "node:assert/strict";
import test from "node:test";
import { classifyFile, MAIN_REQUIRED, VISIBLE_CONTENT_TYPES } from "../src/lib/postContentTypes.ts";

test("Text Post is available and needs no media", () => {
  assert.ok(VISIBLE_CONTENT_TYPES.some((option) => option.value === "TEXT_POST" && option.label === "Text Post"));
  assert.ok(!MAIN_REQUIRED.includes("TEXT_POST"));
});

test("Text Post rejects images, video, scripts, and supporting documents", () => {
  for (const [name, type] of [["photo.jpg", "image/jpeg"], ["clip.mp4", "video/mp4"], ["script.txt", "text/plain"], ["source.pdf", "application/pdf"]]) {
    assert.deepEqual(classifyFile({ name, type }, "TEXT_POST", false), { error: "Text posts use only a caption and source links." });
  }
});

test("Existing social, carousel, and video upload classification remains unchanged", () => {
  const image = { name: "photo.jpg", type: "image/jpeg" };
  assert.deepEqual(classifyFile(image, "SOCIAL_POST", false), { kind: "MAIN" });
  assert.deepEqual(classifyFile(image, "CAROUSEL", true), { kind: "MAIN" });
  assert.deepEqual(classifyFile({ name: "clip.mp4", type: "video/mp4" }, "VIDEO", false), { kind: "MAIN" });
  assert.deepEqual(classifyFile({ name: "source.pdf", type: "application/pdf" }, "SOCIAL_POST", false), { kind: "SUPPORTING" });
});

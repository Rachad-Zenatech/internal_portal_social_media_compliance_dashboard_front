import assert from "node:assert/strict";
import test from "node:test";
import { pendingCheckProgress } from "../src/lib/pendingCheckProgress.ts";

const image = status => ({ id: "image", kind: "MAIN", mime_type: "image/png", original_name: "photo.png", created_at: "2026-11-26", image_text_status: status });

test("completed images do not keep claiming that image processing is running", () => {
  assert.equal(pendingCheckProgress({ images_pending: 1 }, [image("COMPLETED")]).label, "Finishing compliance check");
});
test("an actual image reader still shows processing", () => {
  assert.equal(pendingCheckProgress({ images_pending: 1 }, [image("PROCESSING")]).label, "Processing images");
});
test("unknown current file status never invents completion", () => {
  assert.equal(pendingCheckProgress({ images_pending: 1 }, []).label, "Processing images");
});
test("a failed reader is terminal and needs its result reconciled", () => {
  assert.equal(pendingCheckProgress({ images_pending: 1 }, [image("FAILED")]).label, "Finishing compliance check");
});
test("video and document readers remain represented", () => {
  const video = { ...image(), mime_type: "video/mp4", transcript_status: "PROCESSING" };
  assert.equal(pendingCheckProgress({ images_pending: 1, transcript_pending: true }, [image("PROCESSING"), video]).label, "Processing video and images");
  const doc = { ...image(), mime_type: "application/pdf", original_name: "script.pdf", doc_text_status: "PROCESSING" };
  assert.equal(pendingCheckProgress({ documents_pending: 1 }, [doc]).label, "Reading documents");
});

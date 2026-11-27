import assert from "node:assert/strict";
import test from "node:test";
import { creatorContentReadOnly } from "../src/lib/creatorPostAccess.ts";

test("in-review and approved posts stay locked even if a stale response grants editing", () => {
  for (const status of ["IN_REVIEW", "APPROVED", "REJECTED"]) {
    assert.equal(creatorContentReadOnly(status, false), true);
  }
});

test("drafts and posts returned for changes follow the creator's saved permission", () => {
  for (const status of ["DRAFT", "CHANGES_REQUESTED"]) {
    assert.equal(creatorContentReadOnly(status, false), false);
    assert.equal(creatorContentReadOnly(status, true), true);
  }
});

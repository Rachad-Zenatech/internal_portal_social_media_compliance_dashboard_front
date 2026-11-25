import assert from "node:assert/strict";
import test from "node:test";
import { postSuggestionState } from "../src/lib/postApprovalSuggestions.ts";

const deadline = "2026-11-27T22:00:00Z";
const post = { status: "IN_REVIEW", review_decision_pending: true, suggestions_until: deadline, can_suggest_after_approval: true };

for (const content_type of ["VIDEO", "TEXT_POST", "SOCIAL_POST", "CAROUSEL", "IMAGE", "BLOG", "AD"]) {
test(`${content_type}: a recorded decision stays in review with an active countdown and blocked publishing`, () => {
  const state = postSuggestionState({ ...post, content_type }, Date.parse(deadline) - 60_000);
  assert.equal(state.pending, true);
  assert.equal(state.open, true);
  assert.equal(state.remainingMs, 60_000);
  assert.equal(state.canComment, true);
  assert.equal(state.publishingBlocked, true);
});

test(`${content_type}: late suggestions stop while the backend finishes handing the decision to the creator`, () => {
  const state = postSuggestionState({ ...post, content_type }, Date.parse(deadline));
  assert.equal(state.open, false);
  assert.equal(state.canComment, false);
  assert.equal(state.publishingBlocked, true);
});
}

test("an ordinary undecided review does not pretend a decision has been recorded", () => {
  assert.equal(postSuggestionState({ status: "IN_REVIEW" }).pending, false);
});

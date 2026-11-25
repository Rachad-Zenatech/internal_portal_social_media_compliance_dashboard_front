import assert from "node:assert/strict";
import test from "node:test";
import { postSuggestionState } from "../src/lib/postApprovalSuggestions.ts";

const end = Date.parse("2026-11-25T18:00:00Z");
const held = { status: "IN_REVIEW", review_decision_pending: true,
  suggestions_until: new Date(end).toISOString(), can_suggest_after_approval: true };

for (const outcome of ["approve", "make changes and publish", "make changes and resubmit"]) {
  test(`${outcome}: suggestions stay open while publishing stays blocked`, () => {
    const state = postSuggestionState(held, end - 1000);
    assert.equal(state.open, true);
    assert.equal(state.canComment, true);
    assert.equal(state.publishingBlocked, true);
    assert.equal(state.remainingMs, 1000);
  });
}
test("the exact deadline closes comments but cannot bypass a pending creator handoff", () => {
  const state = postSuggestionState(held, end);
  assert.equal(state.open, false);
  assert.equal(state.canComment, false);
  assert.equal(state.publishingBlocked, true);
});
test("creators see the pending timer without gaining reviewer comment access", () => {
  assert.equal(postSuggestionState({ ...held, can_suggest_after_approval: false }, end - 1).canComment, false);
});
test("released approvals regain publishing access after the deadline", () => {
  const state = postSuggestionState({ ...held, status: "APPROVED", review_decision_pending: false }, end + 1);
  assert.equal(state.pending, false);
  assert.equal(state.open, false);
  assert.equal(state.publishingBlocked, false);
});
test("undecided reviews and already returned change requests do not invent a timer", () => {
  for (const status of ["IN_REVIEW", "CHANGES_REQUESTED"]) {
    assert.equal(postSuggestionState({ ...held, status, review_decision_pending: false }, end - 1).open, false);
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { postSuggestionState, suggestionTimeLabel } from "../src/lib/postApprovalSuggestions.ts";

const end = Date.parse("2026-11-25T22:00:00Z");
const post = { status: "APPROVED", suggestions_until: new Date(end).toISOString(), can_suggest_after_approval: true, can_manage_approval: false };

test("other reviewers can suggest but publishing remains blocked before the deadline", () => {
  const state = postSuggestionState(post, end - 1000);
  assert.equal(state.canComment, true);
  assert.equal(state.publishingBlocked, true);
  assert.equal(state.remainingMs, 1000);
});
test("at the exact deadline suggestions close and publishing opens", () => {
  const state = postSuggestionState(post, end);
  assert.equal(state.canComment, false);
  assert.equal(state.publishingBlocked, false);
});
test("a viewer without permission does not gain comment access from a future date", () => {
  assert.equal(postSuggestionState({ ...post, can_suggest_after_approval: false }, end - 1000).canComment, false);
});
test("the same absolute deadline works across time zones", () => {
  assert.equal(postSuggestionState({ ...post, suggestions_until: "2026-11-25T17:00:00-05:00" }, end - 1000).remainingMs, 1000);
});
test("missing or invalid deadlines never create an indefinite comment window", () => {
  for (const date of [null, "invalid"]) assert.equal(postSuggestionState({ ...post, suggestions_until: date }, end).canComment, false);
});
test("countdown includes days and stops at zero", () => {
  assert.equal(suggestionTimeLabel(90061000), "1d 1h 1m 1s");
  assert.equal(suggestionTimeLabel(-1), "0h 0m 0s");
});

import assert from "node:assert/strict";
import test from "node:test";
import { groupPublishTimes } from "../src/pages/ContentCalendar/groupPublishTimes.ts";

test("posts scheduled for the same instant share a deck across timezone offsets", () => {
  const posts = [
    { id: "toronto", scheduled_for: "2026-11-27T10:00:00-05:00" },
    { id: "utc", scheduled_for: "2026-11-27T15:00:00Z" },
  ];
  assert.deepEqual(groupPublishTimes(posts), [posts]);
});

test("publish decks sort chronologically and retain every colliding post", () => {
  const posts = [
    { id: "later", scheduled_for: "2026-11-27T17:00:00Z" },
    { id: "first", scheduled_for: "2026-11-27T15:00:00Z" },
    { id: "second", scheduled_for: "2026-11-27T15:00:00Z" },
  ];
  assert.deepEqual(groupPublishTimes(posts).map(group => group.map(post => post.id)), [["first", "second"], ["later"]]);
  assert.deepEqual(posts.map(post => post.id), ["later", "first", "second"]);
});

test("different minutes remain separate and empty days have no decks", () => {
  assert.equal(groupPublishTimes([
    { id: "a", scheduled_for: "2026-11-27T15:00:00Z" },
    { id: "b", scheduled_for: "2026-11-27T15:01:00Z" },
  ]).length, 2);
  assert.deepEqual(groupPublishTimes([]), []);
});

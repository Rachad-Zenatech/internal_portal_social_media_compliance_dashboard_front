import assert from "node:assert/strict";
import test from "node:test";
import { orderScreenerQueue } from "../src/lib/screenerQueueOrder.ts";

const items = [
  { id: "later", due_at: "2026-11-30T17:00:00Z", submitted_at: "2026-11-26T12:00:00Z" },
  { id: "missing", due_at: null, submitted_at: "2026-11-26T13:00:00Z" },
  { id: "overdue", due_at: "2026-11-24T17:00:00Z", submitted_at: "2026-11-25T12:00:00Z" },
  { id: "soon", due_at: "2026-11-27T17:00:00Z", submitted_at: "2026-11-26T14:00:00Z" },
];
const ids = rows => rows.map(row => row.id);

test("defaults to earliest deadline, overdue first and undated last", () => {
  assert.deepEqual(ids(orderScreenerQueue(items)), ["overdue", "soon", "later", "missing"]);
  assert.equal(items[0].id, "later", "sorting must not mutate the cached queue");
});

test("manual sent-date sort overrides deadlines in either direction", () => {
  assert.deepEqual(ids(orderScreenerQueue(items, "newest")), ["soon", "missing", "later", "overdue"]);
  assert.deepEqual(ids(orderScreenerQueue(items, "oldest")), ["overdue", "later", "missing", "soon"]);
});

test("invalid dates go last and identical deadlines retain their queue order", () => {
  const rows = [{ id: "bad", due_at: "bad" }, { id: "a", due_at: "2026-11-27T12:00:00Z" }, { id: "b", due_at: "2026-11-27T07:00:00-05:00" }, { id: "empty" }];
  assert.deepEqual(ids(orderScreenerQueue(rows)), ["a", "b", "bad", "empty"]);
});

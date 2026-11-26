import assert from "node:assert/strict";
import test from "node:test";
import { queueStartsCollapsed } from "../src/lib/screenerQueueLayout.ts";

for (const width of [1024, 1280, 1366, 1536, 1600, 1799]) {
  test(`queue starts closed at ${width}px even with an old expanded preference`, () => {
    assert.equal(queueStartsCollapsed(width), true);
    assert.equal(queueStartsCollapsed(width, "0"), true);
  });
}

test("desktop screens retain the saved choice and otherwise start expanded", () => {
  for (const width of [1800, 1920, 2560]) {
    assert.equal(queueStartsCollapsed(width), false);
    assert.equal(queueStartsCollapsed(width, "0"), false);
    assert.equal(queueStartsCollapsed(width, "1"), true);
  }
});

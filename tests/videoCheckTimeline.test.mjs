import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./loadTypeScriptService.mjs";

const { timelineOf, markerStyle } = loadService("videoCheckTimeline", {}, "lib");
const segment = (start_sec, end_sec, traffic_light = "GREEN") => ({ start_sec, end_sec, traffic_light });
const post = segment_flags => ({ latest_check: { segment_flags } });

test("sampled clear timestamps remain visible points, not clear intervals", () => {
  const parts = timelineOf(post([segment(0, 0), segment(5.89, 5.89), segment(64.89, 64.89)]), 70);
  assert.equal(parts.length, 3);
  for (const part of parts) {
    assert.equal(part.start, part.end);
    assert.equal(markerStyle(part, 70).width, "max(4px, 0%)");
  }
});

test("an observation at the final timestamp is retained and clamped inside the track", () => {
  const parts = timelineOf(post([segment(70, 70)]), 70);
  assert.equal(parts.length, 1);
  assert.equal(markerStyle(parts[0], 70).left, "clamp(0px, 100%, calc(100% - 4px))");
});

test("timeline excludes invalid timestamps and separates whole-post flags from timed findings", () => {
  const parts = timelineOf(post([segment(0, 70, "RED"), segment(4, 9, "YELLOW"), segment(10, 10), segment(15, 12), segment(NaN, 20), segment(-2, 3)]), 70);
  assert.equal(parts.length, 2);
  assert.deepEqual(Array.from(parts, part => part.risk), ["YELLOW", "GREEN"]);
});

test("no timestamps or duration does not invent clear footage", () => {
  assert.equal(timelineOf(post([]), 0).length, 0);
  assert.equal(timelineOf(post([segment(0, 0)]), 0).length, 0);
});

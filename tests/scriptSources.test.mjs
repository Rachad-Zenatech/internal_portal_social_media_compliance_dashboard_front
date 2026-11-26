import assert from "node:assert/strict";
import test from "node:test";
import { scriptSourceEntries, scriptSourcesMatch } from "../src/lib/scriptSources.ts";

test("source entries keep names and notes alongside clickable HTTP links", () => {
  const entries = scriptSourceEntries("Defense roles — https://example.com/defense — intended use\nDevelopment — https://example.com/news.");
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0].urls, ["https://example.com/defense"]);
  assert.match(entries[0].text, /intended use/);
  assert.deepEqual(entries[1].urls, ["https://example.com/news"]);
});

test("notes are retained without treating arbitrary schemes as clickable links", () => {
  const entries = scriptSourceEntries("Opening line is commentary; javascript:alert(1)");
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.flatMap((entry) => entry.urls), []);
});

test("changing or clearing sources makes previous checks stale", () => {
  assert.equal(scriptSourcesMatch("old source", "new source"), false);
  assert.equal(scriptSourcesMatch("old source", ""), false);
  assert.equal(scriptSourcesMatch(undefined, "new source"), false);
  assert.equal(scriptSourcesMatch("source\n", "source"), true);
  assert.equal(scriptSourcesMatch(undefined, ""), true);
});

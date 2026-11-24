import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/captionChanges.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const context = { exports: {} };
vm.runInNewContext(outputText, context);
const { captionChanges, captionDiff } = context.exports;

for (const [label, before, after] of [
  ["word replacement", "Supports rescue missions.", "Supports inspection missions."],
  ["negation", "The Army endorsed this.", "The Army has not endorsed this."],
  ["paragraph breaks", "First paragraph.\n\nSecond paragraph.", "First paragraph.\n\nUpdated paragraph."],
  ["new caption", "", "A new caption 🛩️"],
  ["cleared caption", "Remove this caption", ""],
  ["unchanged caption", "Exact text", "Exact text"],
  ["untrusted text", "<script>alert(1)</script>", "<b>Caption</b>"],
]) {
  test(`caption comparison preserves ${label}`, () => {
    const result = captionChanges(before, after);
    assert.equal(result.prefix + result.removed + result.suffix, before);
    assert.equal(result.prefix + result.added + result.suffix, after);
    if (before !== after) assert.notEqual(result.removed, result.added);
  });
}

test("long captions avoid a quadratic diff matrix", () => {
  const before = "caption ".repeat(10_000);
  const result = captionChanges(before, before + "edited");
  assert.equal(result.added, "edited");
  assert.equal(result.removed, "");
});

test("rewrapping checkmark lists is a formatting change, with no false wording highlights", () => {
  const before = "✔ Sync calendars and\nbookings\n✔\nManage workspace reservations";
  const after = "✔ Sync calendars and bookings\n✔ Manage workspace reservations";
  const result = captionDiff(before, after);
  assert.equal(result.formattingOnly, true);
  assert.ok([...result.before, ...result.after].every(part => !part.changed));
  assert.equal(result.before.map(part => part.text).join(""), before);
  assert.equal(result.after.map(part => part.text).join(""), after);
});

test("separate wording edits do not highlight the unchanged sentence between them", () => {
  const result = captionDiff("Reserve desks. Keep your existing tools. Book rooms.", "Find desks. Keep your existing tools. Reserve rooms.");
  assert.equal(result.before.filter(part => part.changed).map(part => part.text).join("|"), "Reserve|Book");
  assert.equal(result.after.filter(part => part.changed).map(part => part.text).join("|"), "Find|Reserve");
  assert.equal(result.formattingOnly, false);
});

test("negation is a wording change even when whitespace also changes", () => {
  const result = captionDiff("The Army\nendorsed this.", "The Army has not endorsed this.");
  assert.equal(result.formattingOnly, false);
  assert.ok(result.after.some(part => part.changed && part.text.includes("not")));
});

test("word-level comparisons preserve exact text for additions, removals, emoji and long captions", () => {
  for (const [before, after] of [["", "Added caption"], ["Old caption", ""], ["✔ Old\n\n🛩️", "✔ New\n🛩️"], ["a ".repeat(2000), "b ".repeat(2000)]]) {
    const result = captionDiff(before, after);
    assert.equal(result.before.map(part => part.text).join(""), before);
    assert.equal(result.after.map(part => part.text).join(""), after);
  }
});

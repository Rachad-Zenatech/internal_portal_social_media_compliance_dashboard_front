import assert from "node:assert/strict";
import test from "node:test";
import { Schema } from "@tiptap/pm/model";
import { matchingQuote } from "../src/lib/replaceQuote.ts";
import { findingEvidence } from "../src/lib/findingEvidence.ts";
import { findAndSelect } from "../src/components/scriptdoc/scriptNoteMarks.ts";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" }, paragraph: { content: "text*", group: "block" }, text: {},
    table: { content: "tableRow+", group: "block" }, tableRow: { content: "tableCell+" }, tableCell: { content: "paragraph+" },
  },
  marks: { strong: {} },
});

function selectIn(doc, term) {
  let selected = null;
  let scrolled = false;
  const chain = {
    focus() { return this; },
    setTextSelection(range) { selected = range; return this; },
    scrollIntoView() { scrolled = true; return this; },
    run() { return true; },
  };
  const found = findAndSelect({ state: { doc }, chain: () => chain }, term);
  return { found, selected: selected && doc.textBetween(selected.from, selected.to, "\n"), scrolled };
}

test("flag selection crosses inline bold formatting", () => {
  const doc = schema.node("doc", null, [schema.node("paragraph", null, [
    schema.text("The aircraft is "), schema.text("under development", [schema.mark("strong")]), schema.text(" for defense missions."),
  ])]);
  assert.deepEqual(selectIn(doc, "aircraft is under development"), { found: true, selected: "aircraft is under development", scrolled: true });
});

test("selection finds a passage across paragraph boundaries", () => {
  const doc = schema.node("doc", null, [schema.node("paragraph", null, schema.text("Plan the complete load.")), schema.node("paragraph", null, schema.text("Include its packaging."))]);
  assert.deepEqual(selectIn(doc, "complete load. Include its packaging."), { found: true, selected: "complete load.\nInclude its packaging", scrolled: true });
});

test("a passage spanning table cells selects the correct document positions", () => {
  const cell = (text) => schema.node("tableCell", null, [schema.node("paragraph", null, schema.text(text))]);
  const doc = schema.node("doc", null, [schema.node("table", null, [schema.node("tableRow", null, [cell("0:11"), cell("The aircraft is under development."), cell("Development status")])])]);
  assert.deepEqual(selectIn(doc, "under development. Development status"), { found: true, selected: "under development.\nDevelopment status", scrolled: true });
});

test("normalization retains the original curly quotes, whitespace and case", () => {
  assert.equal(matchingQuote("The company’s  DEFENSE\nmission", "company's defense mission"), "company’s  DEFENSE\nmission");
});

test("clicking a flag targets its evidence passage rather than a repeated trigger", () => {
  const finding = { flagged_terms: ["aircraft"], passage: "The aircraft is under development.", evaluation: { matched_text: "under development" } };
  const text = "This aircraft is available. The aircraft is under development.";
  assert.equal(matchingQuote(text, findingEvidence(finding)[0]), "The aircraft is under development");
});

test("missing and changed wording does not select unrelated script text", () => {
  const doc = schema.node("doc", null, [schema.node("paragraph", null, schema.text("A development aircraft."))]);
  assert.deepEqual(selectIn(doc, "proven military mission"), { found: false, selected: null, scrolled: false });
  assert.equal(matchingQuote("aircraft development", "craft"), null);
  assert.equal(matchingQuote("aircraft development", ""), null);
});

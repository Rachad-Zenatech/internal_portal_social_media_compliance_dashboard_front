import assert from "node:assert/strict";
import test from "node:test";
import { textToDoc, docToText } from "../src/lib/scriptDoc.ts";

const table = "| Timecode | Visuals | Voiceover | Supers |\n| 0:00 | Aircraft | Narration | Title |\n";
const sourceRow = (text) => textToDoc(table + text).content[0].content.at(-1);

test("sources use two merged cells beneath the four beat columns", () => {
  const row = sourceRow("| Sources used | Defense page https://example.com/defense; Company announcement https://example.com/news | ");
  assert.equal(row.content.length, 2);
  assert.deepEqual(row.content.map((cell) => cell.attrs.colspan), [2, 2]);
  assert.equal(row.content[1].content.length, 2);
});

test("legacy source URL columns collapse into the citation cell", () => {
  const row = sourceRow("| **Sources used (optional)** | Defense and development | https://example.com/defense | https://example.com/news | ");
  assert.equal(row.content.length, 2);
  assert.equal(row.content[1].content.length, 3);
  assert.deepEqual(row.content.map((cell) => cell.attrs.colspan), [2, 2]);
});

test("editing round trips citations and keeps beat columns unchanged", () => {
  const text = table + "| Sources used | First https://example.com/one; Second https://example.com/two |";
  const doc = textToDoc(text);
  assert.equal(doc.content[0].content[0].content.length, 4);
  assert.deepEqual(textToDoc(docToText(doc)), doc);
});

test("empty sources stay editable inside the table", () => {
  const row = sourceRow("| Sources used | | ");
  assert.deepEqual(row.content[1].content, [{ type: "paragraph" }]);
});

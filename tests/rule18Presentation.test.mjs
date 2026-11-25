import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadService } from "./loadTypeScriptService.mjs";

const presentation = loadService("rule18Presentation", {}, "lib");
const { groupRule18, previewFindings, rule18Penalty, isRule18 } = presentation;
const violation = (number, penalty = 5, extra = {}) => ({ rule_number: number, title: "Evidence", penalty, ...extra });
const findings = [
  { key: "other", v: violation("Rule 25", 20) },
  { key: "blood", v: violation("Rule 18") },
  { key: "drone", v: violation("18") },
  { key: "temperature", v: violation("Rule 18", 0) },
];

test("Rule 18 appears as one group, preserving every claim and the saved penalties", () => {
  const before = JSON.stringify(findings);
  const groups = groupRule18(findings, (finding) => finding.v);
  assert.equal(groups.length, 2);
  assert.equal(groups[0][0].key, "other");
  assert.deepEqual(Array.from(groups[1], (finding) => finding.key), ["blood", "drone", "temperature"]);
  assert.equal(rule18Penalty(groups[1].map((finding) => finding.v)), 10);
  assert.equal(JSON.stringify(findings), before);
  assert.equal(isRule18(violation("Rule 118")), false);
});

test("preview hides Rule 18 highlights until a specific claim is selected", () => {
  assert.deepEqual(Array.from(previewFindings(findings, null), (f) => f.key), ["other"]);
  assert.deepEqual(Array.from(previewFindings(findings, "drone"), (f) => f.key), ["other", "drone"]);
  assert.deepEqual(Array.from(previewFindings(findings, "stale-key"), (f) => f.key), ["other"]);
});

test("a penalty already counted under another rule is not charged twice in the summary", () => {
  assert.equal(rule18Penalty([violation("18", 5), violation("18", 5, { counted_with: "Rule 25" })]), 5);
});

const require = createRequire(import.meta.url);
const code = readFileSync(new URL("../src/components/submissions/GroupedComplianceFindings.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
const imports = {
  "@/lib/rule18Presentation": presentation,
  "@/components/submissions/RuleNumberBadge": { __esModule: true, default: ({ v }) => React.createElement("span", {}, v.rule_number) },
};
const context = { exports: {}, require: (name) => imports[name] ?? require(name) };
vm.runInNewContext(outputText, context);
const Group = context.exports.default;
const renderFinding = (finding) => React.createElement("article", { key: finding.key }, finding.key);

test("one initially closed dropdown contains all evidence claims and a combined deduction", () => {
  const html = renderToStaticMarkup(React.createElement(Group, { findings, renderFinding, onClose() {} }));
  assert.equal((html.match(/<details/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.match(html, /3 claims/);
  assert.match(html, /-10 points/);
  for (const finding of findings) assert.match(html, new RegExp(`>${finding.key}</article>`));
});

test("closing the claims dropdown clears the selected preview highlight", () => {
  let cleared = 0;
  const result = Group({ findings, renderFinding, onClose() { cleared++; } });
  const details = result.props.children.find((element) => element.type === "details");
  details.props.onToggle({ currentTarget: { open: true } });
  assert.equal(cleared, 0);
  details.props.onToggle({ currentTarget: { open: false } });
  assert.equal(cleared, 1);
});

test("other rules have no dropdown and keep their normal finding cards", () => {
  const html = renderToStaticMarkup(React.createElement(Group, { findings: [findings[0]], renderFinding, onClose() {} }));
  assert.doesNotMatch(html, /<details/);
  assert.match(html, />other<\/article>/);
});

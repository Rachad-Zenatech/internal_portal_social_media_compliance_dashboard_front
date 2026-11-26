import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
function load(path, imports = {}) {
  const code = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const context = { exports: {}, require: name => imports[name] ?? require(name) };
  vm.runInNewContext(outputText, context);
  return context.exports;
}
const presentation = load("../src/lib/complianceFinding.ts");
const copy = load("../src/lib/findingCopy.ts", { "@/lib/complianceFinding": presentation });
const { FindingExplanation } = load("../src/components/submissions/FindingExplanation.tsx", { "@/lib/findingCopy": copy });
const finding = {
  status: "EVIDENCE_REQUIRED", rule_number: "Rule 18", title: "Financial figure",
  flagged_terms: ["$503,000", "$65 million", "$13.2 million", "$500,000"],
  passage: "on these projects totals approximately $503,000 and supports construction",
  explanation: "Dollar amounts need a source that matches them exactly.", penalty: 5,
};

test("rule-based findings identify the missing AI estimate without inventing confidence", () => {
  assert.match(presentation.findingConfidence(finding), /not assessed.*rule-based/);
  assert.equal(presentation.findingConfidence({ ...finding, evaluation: { source: "AI", confidence: 0.85 } }), "AI confidence: 85%");
  assert.equal(presentation.findingConfidence({ ...finding, evaluation: { source: "UNAVAILABLE", confidence: 0 } }), null);
});

test("an unresolved financial request allows an attached source and shows every flagged amount", () => {
  const before = JSON.stringify(finding);
  const html = renderToStaticMarkup(React.createElement(FindingExplanation, { v: finding }));
  for (const amount of finding.flagged_terms) assert.ok(html.includes(amount));
  assert.match(html, /Why this still needs verification/);
  assert.match(html, /If a source is already attached/);
  assert.match(html, /Equivalent wording is acceptable/);
  assert.doesNotMatch(html, /matches them exactly|No readable supporting source/);
  assert.equal(JSON.stringify(finding), before);
});

test("actual AI reasoning and confidence remain visible without generic replacement", () => {
  const v = { ...finding, evaluation: { source: "AI", confidence: 0.8, reasoning: "The source reports project value, but the post calls it company revenue." } };
  const html = renderToStaticMarkup(React.createElement(FindingExplanation, { v }));
  assert.match(html, /source reports project value/);
  assert.doesNotMatch(html, /rule-based check|If a source is already attached/);
  assert.equal(presentation.findingConfidence(v), "AI confidence: 80%");
});

test("Rule 18 AI findings require at least 70 percent while other rules retain their cutoff", () => {
  for (const status of ["VIOLATION", "NEEDS_REVIEW", "EVIDENCE_REQUIRED"]) {
    for (const [confidence, visible] of [[0.5, false], [0.699, false], [0.7, true], [0.85, true]]) {
      assert.equal(presentation.isVisibleFinding({ ...finding, status, evaluation: { source: "AI", confidence } }), visible);
    }
  }
  assert.equal(presentation.isVisibleFinding({ ...finding, rule_number: "Rule 25", status: "NEEDS_REVIEW", evaluation: { source: "AI", confidence: 0.6 } }), true);
  assert.equal(presentation.isVisibleFinding(finding), true);
  assert.equal(presentation.isVisibleFinding({ ...finding, status: "CLEARED", evaluation: { source: "AI", confidence: 0.2 } }), true);
});


test("uncertain image wording is readable and preserves exact evidence", () => {
  const v = { ...finding, rule_number: "Rule 28", title: "No Crime References", status: "NEEDS_REVIEW", passage: "MAFIA", image_file_ids: ["image-1"],
    remediation_guidance: "Remove the wording, or blur or crop it from the image.",
    evaluation: { source: "AI", confidence: 0.5, reasoning: "Visual review of deskfles.png: An enlarged image section suggests prohibited wording, but the letters are uncertain. A reviewer should inspect this specific area." } };
  const html = renderToStaticMarkup(React.createElement(FindingExplanation, { v }));
  assert.match(html, /Evidence considered:.*MAFIA/);
  assert.match(html, /Why this needs review/);
  assert.match(html, /too small or blurry to read confidently/);
  assert.match(html, /What to do/);
  assert.match(html, /Check the flagged area.*first.*If you confirm the issue/);
  assert.doesNotMatch(html, /Visual review of|enlarged image section|prohibited wording/);
});

test("an unclear source claim always has a next step without inventing missing evidence", () => {
  const v = { ...finding, status: "NEEDS_REVIEW", passage: "Blood transport requires validation of the complete delivery system.",
    evaluation: { source: "AI", confidence: 0.75, reasoning: "The source describes packaging tests, but it is not clear whether these cover the whole delivery system." } };
  const details = copy.findingCopy(v);
  assert.equal(details.evidence, v.passage);
  assert.equal(details.reasoning, v.evaluation.reasoning);
  assert.match(details.action, /Open Sources checked/);
  assert.match(details.action, /ask a reviewer/);
});

test("reviewer and creator share evidence, explanation and action", () => {
  const { default: ReviewerFindingDetails } = load("../src/components/submissions/ReviewerFindingDetails.tsx", {
    "@/components/submissions/FindingExplanation": { FindingExplanation },
    "@/components/submissions/FindingStatus": { statusOf: v => v.status ?? "VIOLATION", ConfidenceBadge: () => null },
  });
  const v = { ...finding, evaluation: { source: "AI", confidence: 0.8, reasoning: "The source reports project value, not company revenue.", recommended_action: "Use project value instead of revenue, or add a source for the revenue figure." } };
  for (const Component of [FindingExplanation, ({ v }) => React.createElement(ReviewerFindingDetails, { finding: v })]) {
    const html = renderToStaticMarkup(React.createElement(Component, { v }));
    for (const text of ["Evidence considered:", "Why this still needs verification:", "What to do:", v.passage, v.evaluation.reasoning, v.evaluation.recommended_action]) assert.ok(html.includes(text));
    assert.equal((html.match(/What to do:/g) ?? []).length, 1);
  }
});

test("dismissal request and decision show clean separators while preserving names and notes", () => {
  const { default: FlagDismissalSummary } = load("../src/components/submissions/FlagDismissalSummary.tsx");
  for (const kind of ["requested", "dismissed"]) {
    const html = renderToStaticMarkup(React.createElement(FlagDismissalSummary, { kind, name: "Arifa Mansoor", reason: "Acceptable in this context", note: "The source supports this.", age: "2 minutes ago" }));
    assert.match(html, /by Arifa Mansoor - Acceptable in this context/);
    assert.match(html, /The source supports this/);
    assert.doesNotMatch(html, /[\u00c2\u00c3]/);
  }
});

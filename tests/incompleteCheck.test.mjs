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
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const context = { exports: {}, require: name => imports[name] ?? require(name) };
  vm.runInNewContext(outputText, context);
  return context.exports;
}
const diagnostics = load("lib/incompleteCheck.ts");
const { incompleteCheckDetails } = diagnostics;
const unavailable = load("components/submissions/UnavailableCompliance.tsx", { "@/lib/incompleteCheck": diagnostics });

test("new results identify source truncation instead of claiming the whole AI is unavailable", () => {
  const check = { score: 100, ai_unavailable: true, incomplete_stages: [{ stage: "SOURCE_VERIFICATION", code: "OUTPUT_LIMIT", reason: "Source comparisons were cut off before the answers finished." }] };
  const html = renderToStaticMarkup(React.createElement(unavailable.default, { check }));
  assert.match(html, /Source verification did not finish/);
  assert.match(html, /cut off/);
  assert.match(html, /score is provisional, even if it is 100/);
});

test("the previously saved SUB-1214-shaped result identifies source verification", () => {
  const details = incompleteCheckDetails({ ai_unavailable: true, source_checks: [{ status: "READ", message: "No AI model could compare the assigned claims just now. Check again to finish.", claims: [] }], visual_checks: [{ status: "COMPLETED" }] });
  assert.equal(details.title, "Source verification did not finish");
  assert.equal(details.reasons.length, 1);
  assert.match(details.reasons[0], /sources were read/);
});

test("manual-review rules alone are not represented as failed AI steps", () => {
  const details = incompleteCheckDetails({ ai_unavailable: true, manual_review_rules: [{ rule_number: "Rule 18" }, { rule_number: "Rule 22" }] });
  assert.equal(details.reasons.length, 0);
});

test("empty findings explain incomplete coverage instead of implying a clean check", () => {
  const html = renderToStaticMarkup(React.createElement(unavailable.IncompleteFindingsNotice));
  assert.match(html, /does not mean the post is clear/);
});

test("a provisional 100 uses amber while a completed 100 remains green", () => {
  const summary = load("components/submissions/ComplianceScoreSummary.tsx", { "@/components/submissions/PendingDismissalScore": { __esModule: true, default: () => null } }).default;
  const props = { score: 100, minimumScore: 90, heading: "Provisional score", description: "Completed steps only" };
  const provisional = renderToStaticMarkup(React.createElement(summary, { ...props, provisional: true }));
  const complete = renderToStaticMarkup(React.createElement(summary, props));
  assert.match(provisional, /#D97706/);
  assert.match(complete, /#059669/);
  assert.match(provisional, />100</);
});

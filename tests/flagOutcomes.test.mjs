import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
let state = {};
const source = readFileSync(new URL("../src/components/submissions/CreatorFlagOutcomes.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
const context = { exports: {}, require: name => name === "@/hooks/useFlagOutcomes" ? { useFlagOutcomes: () => state } : require(name) };
vm.runInNewContext(outputText, context);
const Component = context.exports.default;
const render = () => renderToStaticMarkup(React.createElement(Component, { submissionId: "post-1", currentVersion: 2 }));
const item = { rule_id: "r1", rule_number: "Rule 18", version_number: 1, reason: "Evidence is on file", reviewer_name: "Reviewer One", note: "See the attached release" };

test("returned creators see direct dismissals and accepted and declined requests", () => {
  for (const [outcome, label] of [["DISMISSED", "Flag dismissed by reviewer"], ["APPROVED", "Your dismissal request was accepted"], ["REJECTED", "Your dismissal request was declined"]]) {
    state = { data: [{ ...item, outcome }] };
    const html = render();
    assert.ok(html.includes(label));
    assert.match(html, /Reviewer One/);
    assert.match(html, /See the attached release/);
    assert.match(html, /Version 1/);
    assert.match(html, /do not automatically clear flags/);
    assert.equal(html.includes("Please address this concern"), outcome === "REJECTED");
    assert.doesNotMatch(html, /Add dismissal request|Undo/);
  }
});

test("old decisions with no saved reviewer metadata stay readable", () => {
  state = { data: [{ ...item, outcome: "REJECTED", reviewer_name: null, note: null }] };
  assert.match(render(), /A reviewer/);
  assert.doesNotMatch(render(), /undefined|null|Reviewer note:/);
});

test("empty, loading and error states do not masquerade as no reviewer decisions", () => {
  state = { data: [] };
  assert.equal(render(), "");
  state = { isPending: true };
  assert.match(render(), /Loading reviewer decisions/);
  state = { isError: true, refetch() {} };
  assert.match(render(), /could not be loaded.*Try again/);
});

test("a collapsed or read-only flag shows its own current-version decision only", () => {
  const Inline = context.exports.InlineFlagOutcome;
  const renderInline = () => renderToStaticMarkup(React.createElement(Inline, { submissionId: "post-1", ruleId: "r1", currentVersion: 2 }));
  state = { data: [{ ...item, outcome: "APPROVED", version_number: 2 }] };
  assert.match(renderInline(), /Reviewer decision for this flag/);
  assert.match(renderInline(), /dismissal request was accepted/);
  state = { data: [{ ...item, outcome: "REJECTED", rule_id: "other", version_number: 2 }] };
  assert.equal(renderInline(), "");
  state = { data: [{ ...item, outcome: "DISMISSED", version_number: 1 }] };
  assert.equal(renderInline(), "");
});

test("returned-post decisions remain visible while reviewer text edits are loading", () => {
  const code = readFileSync(new URL("../src/components/submissions/SubmissionReviewUpdates.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const imports = {
    "./CreatorFlagOutcomes": { __esModule: true, default: Component },
    "@/components/ui/button": { Button: () => null },
    "./PostStepNav": { StepFooter: () => null },
    "./IncomingTextComparison": { __esModule: true, default: () => null },
    "@/hooks/useCreatorReviewUpdates": { useCreatorReviewUpdates: () => ({ isPending: true }) },
  };
  const wrapper = { exports: {}, require: name => imports[name] ?? require(name) };
  vm.runInNewContext(compiled.outputText, wrapper);
  state = { data: [{ ...item, outcome: "REJECTED" }] };
  const html = renderToStaticMarkup(React.createElement(wrapper.exports.default, {
    suggestions: true, textOnly: false, submissionId: "post-1", version: 2, hasFeedback: false, onContinue() {},
  }));
  assert.match(html, /Your dismissal request was declined/);
  assert.match(html, /Loading reviewer edits/);
});

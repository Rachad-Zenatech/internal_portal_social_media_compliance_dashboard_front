import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
let state, options;
const service = { list: () => [] };
function load(path, imports) {
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const context = { exports: {}, require: name => imports[name] ?? require(name) };
  vm.runInNewContext(outputText, context);
  return context.exports;
}
const hook = load("hooks/useFlagOutcomes.ts", {
  "@tanstack/react-query": { useQuery: value => { options = value; return state; } },
  "@/services/flagOutcomeService": { flagOutcomeService: service },
});
const view = load("components/submissions/CreatorFlagOutcomes.tsx", { "@/hooks/useFlagOutcomes": hook });
const render = (version, inline = false) => renderToStaticMarkup(React.createElement(
  inline ? view.InlineFlagOutcome : view.default, { submissionId: "post-1", currentVersion: version, ruleId: "rule-18" }));

test("never-submitted drafts do not request reviewer history or show loading/errors", () => {
  for (state of [{ isPending: true }, { isError: true }]) {
    assert.equal(render(0), "");
    assert.equal(options.enabled, false);
    assert.equal(render(0, true), "");
    assert.equal(options.enabled, false);
  }
});

test("previously submitted posts still load and display their review history", () => {
  state = { data: [{ rule_id: "rule-18", rule_number: "Rule 18", version_number: 1,
    outcome: "DISMISSED", reason: "Evidence verified", reviewer_name: "Reviewer" }] };
  assert.match(render(2), /Evidence verified/);
  assert.match(render(2), /Version 1/);
  assert.equal(options.enabled, true);
});

test("history errors stay visible where review history is expected", () => {
  state = { isError: true };
  assert.match(render(1), /Reviewer decisions could not be loaded/);
  assert.equal(options.enabled, true);
});

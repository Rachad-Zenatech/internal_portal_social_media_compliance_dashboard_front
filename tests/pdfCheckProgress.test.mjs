import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const cache = new Map();
function load(relative) {
  const path = new URL(relative, import.meta.url);
  if (cache.has(path.href)) return cache.get(path.href);
  const code = readFileSync(path, "utf8");
  const { outputText } = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const context = { exports: {}, require: name => name.startsWith(".")
    ? load(new URL(name + (name.endsWith("Presentation") ? ".ts" : ".tsx"), path).href) : require(name) };
  vm.runInNewContext(outputText, context);
  cache.set(path.href, context.exports);
  return context.exports;
}
const { CheckProgress, CheckModelsUsed } = load("../src/components/submissions/CheckProgress.tsx");
const { relation, summary, retryCounts } = load("../src/components/submissions/checkProgressPresentation.ts");
const attempt = { id: "first", model: "us.anthropic.claude-haiku-5-5", feature: "SOURCE_PDF_TEXT", status: "OK", duration_ms: 1000 };
const render = attempts => renderToStaticMarkup(React.createElement(CheckProgress, { attempts, startedAt: Date.now() }));

test("PDF progress shows the actual batch total and page range beside the model", () => {
  const html = render([{ ...attempt, progress_label: "Reading PDF batch 1/25 (pages 1-2)" },
    { ...attempt, id: "second", status: "RUNNING", progress_label: "Reading PDF batch 2/25 (pages 3-4)" }]);
  assert.match(html, /Reading source PDF/);
  assert.match(html, /Reading PDF batch 1\/25 \(pages 1-2\)/);
  assert.match(html, /Reading PDF batch 2\/25 \(pages 3-4\)/);
  assert.match(html, /us.anthropic.claude-haiku-5-5/);
  assert.match(html, /In progress/);
});

test("older saved attempts still render without invented batch counts", () => {
  const html = render([attempt]);
  assert.match(html, /Reading source PDF/);
  assert.match(html, /Completed in/);
  assert.doesNotMatch(html, /Reading PDF batch|undefined|NaN/);
});


test("repeated model calls are explained as separate evidence checks", () => {
  const html = render([{ ...attempt, feature: "SOURCE_CHECK", task_id: "a", progress_label: "Identifying factual claims in your post" },
    { ...attempt, id: "second", task_id: "b", feature: "SOURCE_CHECK", status: "RUNNING", progress_label: "Checking 2 claims against CBO report" }]);
  assert.match(html, /Separate checks identify claims and compare them with relevant sources/);
  assert.match(html, /1 completed/);
  assert.match(html, /1 in progress/);
  assert.match(html, /Checking 2 claims against CBO report/);
  assert.match(html, /View completed requests and errors/);
  assert.doesNotMatch(html, /trying the next model|Fallback/);
});

test("a failure in another task is never called a retry or fallback", () => {
  const attempts = [{ ...attempt, id: "failed", task_id: "first-task", status: "FAILED" },
    { ...attempt, id: "ok", task_id: "second-task" }];
  assert.equal(relation(attempts, 1), null);
  assert.equal(retryCounts(attempts).fallbacks, 0);
  assert.doesNotMatch(render(attempts), /trying the next model|Fallback|Retry/);
});

test("same-task retries are distinct from switching models", () => {
  const attempts = [{ ...attempt, status: "FAILED", task_id: "one" },
    { ...attempt, id: "retry", status: "FAILED", task_id: "one" },
    { ...attempt, id: "fallback", model: "another-model", status: "RUNNING", task_id: "one" }];
  assert.equal(relation(attempts, 1), "Retry");
  assert.equal(relation(attempts, 2), "Fallback");
  assert.deepEqual(JSON.parse(JSON.stringify(summary(attempts))), { completed: 0, running: 1, failed: 0 });
});

test("older saved events never invent retry relationships", () => {
  assert.equal(relation([{ ...attempt, status: "FAILED" }, { ...attempt, id: "next" }], 1), null);
});

test("the saved summary does not call every failed request a fallback", () => {
  const attempts = [{ ...attempt, status: "FAILED" }, { ...attempt, id: "second" }];
  const html = renderToStaticMarkup(React.createElement(CheckModelsUsed, { attempts, durationMs: 4000 }));
  assert.match(html, /1 failed request/);
  assert.doesNotMatch(html, /after 1 fallback/);
});

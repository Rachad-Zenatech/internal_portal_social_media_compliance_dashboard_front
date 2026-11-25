import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const code = readFileSync(new URL("../src/components/submissions/CheckProgress.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
const context = { exports: {}, require };
vm.runInNewContext(outputText, context);
const { CheckProgress } = context.exports;
const attempt = { id: "first", model: "us.anthropic.claude-haiku-5-5", feature: "SOURCE_PDF_TEXT", status: "OK", duration_ms: 1000 };
const render = attempts => renderToStaticMarkup(React.createElement(CheckProgress, { attempts, startedAt: Date.now() }));

test("PDF progress shows the actual batch total and page range beside the model", () => {
  const html = render([{ ...attempt, progress_label: "Reading PDF batch 1/25 (pages 1-2)" },
    { ...attempt, id: "second", status: "RUNNING", progress_label: "Reading PDF batch 2/25 (pages 3-4)" }]);
  assert.match(html, /Reading source PDF/);
  assert.match(html, /Reading PDF batch 1\/25 \(pages 1-2\)/);
  assert.match(html, /Reading PDF batch 2\/25 \(pages 3-4\)/);
  assert.match(html, /us.anthropic.claude-haiku-5-5/);
  assert.match(html, /working/);
});

test("older saved attempts still render without invented batch counts", () => {
  const html = render([attempt]);
  assert.match(html, /Reading source PDF/);
  assert.match(html, /answered in/);
  assert.doesNotMatch(html, /Reading PDF batch|undefined|NaN/);
});


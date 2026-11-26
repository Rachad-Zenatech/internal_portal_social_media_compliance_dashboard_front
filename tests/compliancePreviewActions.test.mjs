import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/components/submissions/CompliancePreviewActions.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
const context = { exports: {}, require: name => name === "@/components/ui/button" ? { Button: ({ children }) => React.createElement("button", null, children) } : require(name) };
vm.runInNewContext(outputText, context);
const render = props => renderToStaticMarkup(React.createElement(context.exports.default, { textOnly: false, script: false, video: false, onEditText() {}, onReplaceMedia() {}, ...props }));

test("text posts offer text editing without media replacement", () => {
  const html = render({ textOnly: true });
  assert.match(html, /Edit text/);
  assert.doesNotMatch(html, /Replace|caption/);
});

test("image and video posts keep their media controls and use Edit text", () => {
  assert.match(render({}), /Edit text.*Replace image/);
  assert.match(render({ video: true }), /Edit text.*Replace video/);
});

test("script posts keep script-specific actions", () => {
  assert.match(render({ script: true }), /Edit post details.*Replace script/);
});

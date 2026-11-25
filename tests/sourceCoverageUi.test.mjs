import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadService } from "./loadTypeScriptService.mjs";

const require = createRequire(import.meta.url);
const coverage = loadService("sourceCoverage", {}, "lib");
const visibility = loadService("sourceCheckVisibility", {}, "lib");
const merging = loadService("mergeSourceChecks", {}, "lib", { URL });
const imports = {
  "@/components/submissions/ClaimVsSource": { __esModule: true, default: () => null },
  "@/components/submissions/SourceTrustBar": { __esModule: true, default: () => null },
  "@/components/submissions/sourceConfirmationsContext": {
    SourceConfirmationsProvider: ({ children }) => children,
    useSourceCalls: () => null,
  },
  "@/lib/sourceCoverage": coverage,
  "@/lib/sourceCheckVisibility": visibility,
  "@/lib/mergeSourceChecks": merging,
};
const source = readFileSync(new URL("../src/components/submissions/SourceChecks.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
const context = { exports: {}, require: name => imports[name] ?? require(name) };
vm.runInNewContext(outputText, context);
const SourceChecks = context.exports.default;
const claim = (text, verdict) => ({ claim: text, verdict, where: "caption", confidence: .9 });
const article = (reference, claims) => ({ reference, title: reference, kind: "URL", where: "source_links", status: "READ", claims });
const zero = "Zero.That is how many government contracts a company needs to request time on an Army test range.";
const render = checks => renderToStaticMarkup(React.createElement(SourceChecks, { checks, creator: true }));

test("a supported Zero claim is not counted as an unresolved omission in another article", () => {
  const html = render([article("August announcement", [claim(zero, "SUPPORTED")]), article("Indiana announcement", [claim(zero, "NOT_FOUND")])]);
  assert.match(html, /Needs review \(0\)/);
  assert.match(html, /1 supported elsewhere/);
  assert.doesNotMatch(html, /1 to check/);
});

test("only the unsupported quiet-skies claim remains actionable while Zero is marked covered", () => {
  const html = render([
    article("August announcement", [claim(zero, "SUPPORTED")]),
    article("Indiana announcement", [claim(zero, "NOT_FOUND"), claim("Most companies have been testing in quiet skies.", "NOT_FOUND")]),
  ]);
  assert.match(html, /Needs review \(1\)/);
  assert.match(html, /1 supported elsewhere/);
  assert.match(html, /1 to check/);
  assert.match(html, /Supported by another source/);
  assert.match(html, /Supported by another attached source: August announcement/);
});

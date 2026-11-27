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
const groups = loadService("sourceClaimGroups", { "@/lib/sourceCoverage": coverage, "@/lib/sourceCheckVisibility": visibility }, "lib");
let selectedTab;
const imports = {
  "react": { ...React, useState: initial => React.useState(typeof initial === "string" && selectedTab ? selectedTab : initial) },
  "@/components/submissions/ClaimVsSource": { __esModule: true, default: () => null },
  "@/components/submissions/SourceTrustBar": { __esModule: true, default: () => null },
  "@/components/submissions/SourceFallback": { __esModule: true, default: () => null },
  "@/components/submissions/sourceConfirmationsContext": {
    SourceConfirmationsProvider: ({ children }) => children,
    useSourceCalls: () => null,
  },
  "@/lib/sourceCoverage": coverage,
  "@/lib/sourceCheckVisibility": visibility,
  "@/lib/mergeSourceChecks": merging,
  "@/lib/sourceClaimGroups": groups,
};
function component(name) {
  const source = readFileSync(new URL(`../src/components/submissions/${name}.tsx`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const context = { exports: {}, require: name => imports[name] ?? require(name) };
  vm.runInNewContext(outputText, context);
  return context.exports.default;
}
imports["@/components/submissions/UnmatchedSourceClaims"] = { __esModule: true, default: component("UnmatchedSourceClaims") };
const SourceChecks = component("SourceChecks");
const claim = (text, verdict) => ({ claim: text, verdict, where: "caption", confidence: .9 });
const article = (reference, claims) => ({ reference, title: reference, kind: "URL", where: "source_links", status: "READ", claims });
const zero = "Zero.That is how many government contracts a company needs to request time on an Army test range.";
const render = (checks, tab = "checks") => {
  selectedTab = tab;
  return renderToStaticMarkup(React.createElement(SourceChecks, { checks, creator: true }));
};

test("a supported Zero claim is not counted as an unresolved omission in another article", () => {
  const html = render([article("August announcement", [claim(zero, "SUPPORTED")]), article("Indiana announcement", [claim(zero, "NOT_FOUND")])]);
  assert.match(html, /Needs review \(0\)/);
  assert.match(html, /Unmatched claims \(0\)/);
  assert.doesNotMatch(html, /Not in the source/);
  assert.doesNotMatch(html, /1 to check/);
});

test("only the unsupported quiet-skies assertion appears in the unmatched tab", () => {
  const checks = [
    article("August announcement", [claim(zero, "SUPPORTED")]),
    article("Indiana announcement", [claim(zero, "NOT_FOUND"), claim("Most companies have been testing in quiet skies.", "NOT_FOUND")]),
  ];
  const html = render(checks);
  assert.match(html, /Needs review \(0\)/);
  assert.match(html, /Unmatched claims \(1\)/);
  assert.doesNotMatch(html, /Not in the source|Most companies have been testing/);
  const unmatched = render(checks, "unmatched");
  assert.match(unmatched, /Most companies have been testing in quiet skies/);
  assert.doesNotMatch(unmatched, /Zero.That|Not in the source/);
});

test("contradictions stay under their source and unreadable PDFs remain visible", () => {
  const html = render([
    article("Report", [claim("Claimed capacity", "CONTRADICTED")]),
    { ...article("Unreadable PDF", []), status: "UNREADABLE", message: "Could not read the PDF" },
  ], "review");
  assert.match(html, /Needs review \(2\)/);
  assert.match(html, /Doesn&#x27;t match/);
  assert.match(html, /Could not read the PDF/);
  assert.match(html, /Unmatched claims \(0\)/);
});


test("automatic sources clearly identify the ZenaTech Newsroom and explain filtered results", () => {
  const html = render([{ ...article("Rattler announcement", [claim("Medical resupply is a target application", "SUPPORTED")]), where: "newsroom" }]);
  assert.match(html, /ZenaTech Newsroom \(automatic cross-check\)/);
  assert.match(html, /Other searched articles may not appear/);
  assert.match(html, /1 match</);
  assert.doesNotMatch(html, /1 matches|automatic supporting cross-check/);
});

test("two newsroom articles are both shown when each has confirmed evidence", () => {
  const html = render([
    { ...article("Rattler announcement", [claim("Medical resupply is a target application", "SUPPORTED")]), where: "newsroom" },
    { ...article("Development announcement", [claim("ZenaDrone 1000 is under development", "SUPPORTED")]), where: "newsroom" },
  ]);
  assert.match(html, /Rattler announcement/);
  assert.match(html, /Development announcement/);
  assert.match(html, /All sources \(2\)/);
});

test("a completed check does not display a removed link's old quick-check evidence", () => {
  selectedTab = "checks";
  const html = renderToStaticMarkup(React.createElement(SourceChecks, {
    checks: [], creator: true,
    savedChecks: { old: article("Old manually attached result", [claim("Old supported claim", "SUPPORTED")]) },
  }));
  assert.doesNotMatch(html, /Old manually attached result|Old supported claim/);
});

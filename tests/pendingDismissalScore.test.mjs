import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import ts from "typescript";
import { loadService } from "./loadTypeScriptService.mjs";

const { reviewSendScore } = loadService("reviewSendScore", {}, "lib");
const finding = (id, penalty, terms = []) => ({ rule_id: id, rule_number: id, penalty, flagged_terms: terms });
const request = (id, extra = {}) => ({ rule_id: id, status: "PENDING", version_number: 2, flagged_terms: [], ...extra });
const check = (score, violations, extra = {}) => ({ score, violations, ...extra });

function loadComponent(name, dependencies = {}) {
  const source = readFileSync(new URL(`../src/components/submissions/${name}.tsx`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX,
  } });
  const module = { exports: {} };
  const require = createRequire(import.meta.url);
  runInNewContext(outputText, { module, exports: module.exports, require: (id) => {
    if (id in dependencies) return dependencies[id];
    assert.equal(id, "react/jsx-runtime");
    return require(id);
  } });
  return module.exports.default;
}
const PendingScore = loadComponent("PendingDismissalScore");
const Summary = loadComponent("ComplianceScoreSummary", {
  "@/components/submissions/PendingDismissalScore": { __esModule: true, default: PendingScore },
});

test("requests unlock routing at 90 without mutating the original score", () => {
  const original = check(80, [finding("Script", 10), finding("Rule 18", 10)]);
  assert.equal(reviewSendScore(original, [request("Script")], 2), 90);
  assert.equal(original.score, 80);
  const html = renderToStaticMarkup(createElement(PendingScore, { originalScore: 80, recalculatedScore: 90, minimumScore: 90 }));
  assert.match(html, /90\/100/);
  assert.match(html, /80\/100/);
  assert.match(html, /You can send this post for review/);
  assert.match(html, /reviewer must decide/);
});

test("the original-90 screenshot gets a separate 100 score", () => {
  const original = check(90, [finding("Script", 10)]);
  const score = reviewSendScore(original, [request("Script")], 2);
  const html = renderToStaticMarkup(createElement(Summary, {
    score: 90, minimumScore: 90, heading: "1 thing to check", description: "Original check", recalculatedScore: score,
  }));
  assert.equal(score, 100);
  assert.match(html, /Score 90 out of 100/);
  assert.match(html, /100\/100/);
  assert.equal(original.score, 90);
});

test("insufficient requested deductions do not grant bypass", () => {
  const original = check(75, [finding("one", 10), finding("two", 15)]);
  const score = reviewSendScore(original, [request("one")], 2);
  assert.equal(score, 85);
  const html = renderToStaticMarkup(createElement(PendingScore, { originalScore: 75, recalculatedScore: score, minimumScore: 90 }));
  assert.match(html, /needs 5 more points/);
  assert.doesNotMatch(html, /You can send/);
});

test("rejected, stale-version and changed-evidence requests cannot raise the score", () => {
  const original = check(80, [finding("one", 20, ["current evidence"])]);
  for (const item of [request("one", { status: "REJECTED" }), request("one", { version_number: 1 }), request("one")]) {
    assert.equal(reviewSendScore(original, [item], 2), 80);
  }
});

test("duplicate requests do not add points twice; incomplete checks have no recalculated score", () => {
  const original = check(90, [finding("one", 10)]);
  assert.equal(reviewSendScore(original, [request("one"), request("one")], 2), 100);
  assert.equal(reviewSendScore({ ...original, ai_unavailable: true }, [request("one")], 2), undefined);
  assert.equal(reviewSendScore({ ...original, analysis_pending: true }, [request("one")], 2), undefined);
  assert.equal(renderToStaticMarkup(createElement(PendingScore, { originalScore: 90, minimumScore: 90 })), "");
});

test("overlapping deductions are restored and legacy caps are not silently refunded", () => {
  const original = check(80, [finding("one", 20), { ...finding("two", 0), counted_with: "one", uncounted_penalty: 15 }]);
  assert.equal(reviewSendScore(original, [request("one")], 2), 85);
  assert.equal(reviewSendScore(check(50, [finding("one", 35)]), [request("one")], 2), 85);
});

test("the Send for Review button uses the recalculated threshold without changing the saved score", () => {
  function renderActions(score, pending) {
    const Actions = loadComponent("SubmissionSendActions", {
      "@/components/submissions/PendingDismissalScore": { __esModule: true, default: PendingScore },
      "@/components/submissions/RevisionPublishActions": { __esModule: true, default: () => null },
      "@/hooks/useReviewSendScore": { useReviewSendScore: () => pending },
      "@/components/ui/button": { Button: (props) => createElement("button", props) },
      "lucide-react": { Loader2: () => null, Send: () => null },
    });
    return renderToStaticMarkup(createElement(Actions, {
      submissionId: "post", currentVersion: 2, score, minimumScore: 90, check: {},
      hasCheck: true, checkStale: false, disabled: false, submitting: false,
      publishAfterChanges: false, videoLocked: false, resubmitting: false, onSubmit() {},
    }));
  }
  const eligible = renderActions(80, 90);
  assert.match(eligible, /Original compliance score: <strong>80\/100/);
  assert.doesNotMatch(eligible, /<button[^>]*disabled/);
  assert.match(eligible, /Send for Review/);
  const blocked = renderActions(75, 85);
  assert.match(blocked, /<button[^>]*disabled/);
  assert.match(blocked, /needs 5 more points/);
});

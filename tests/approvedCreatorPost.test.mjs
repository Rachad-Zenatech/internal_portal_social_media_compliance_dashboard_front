import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
let viewer = "creator";
const dependencies = {
  "@/lib/AuthContext": { useAuth: () => ({ user: { id: viewer } }) },
  "react-router-dom": { Link: ({ children }) => React.createElement("a", null, children) },
  "@/hooks/useImageSlideshow": { useImageSlideshow: () => ({ slides: [] }) },
  "./submissionUi": { authedFileUrl: url => url },
  "./MarkedUpImageSlideshow": { __esModule: true, default: () => null },
  "./FormattedCaptionPreview": { __esModule: true, default: ({ html, parts }) => React.createElement("div", { "data-saved-html": html }, parts[0].text) },
  "./ReviewCommentsPanel": { __esModule: true, default: () => null },
  "./CreatorFlagOutcomes": { __esModule: true, default: () => React.createElement("div", null, "Reviewer decisions") },
  "./ApprovedPublishActions": { __esModule: true, default: () => React.createElement("button", null, "Choose publishing date") },
};
const code = readFileSync(new URL("../src/components/submissions/ApprovedCreatorPost.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
const module = { exports: {} };
vm.runInNewContext(outputText, { exports: module.exports, require: name => dependencies[name] ?? require(name) });
const post = { id: "post", created_by: "creator", title: "Approved post", reference_code: "SUB-1", current_version: 1, files: [], platforms: ["FACEBOOK"], caption_text: "Approved text", caption_html: "<p><b>Approved text</b></p>" };
const render = (value = post) => renderToStaticMarkup(React.createElement(module.exports.default, { post: value }));

test("clean approval is read-only and goes directly to scheduling without analysis controls", () => {
  viewer = "creator";
  const html = render();
  assert.match(html, /Approved without changes/);
  assert.match(html, /do not need to rerun compliance or sentiment/);
  assert.match(html, /Choose publishing date/);
  assert.match(html, /Reviewer decisions/);
  assert.match(html, /data-saved-html=/);
  assert.doesNotMatch(html, /<textarea|contenteditable|Edit text|Replace image|Run compliance|Run sentiment/);
});

test("someone viewing another creator's approved post cannot schedule it", () => {
  viewer = "other";
  assert.doesNotMatch(render(), /Choose publishing date/);
});

test("approved video is viewable without upload or replacement controls", () => {
  viewer = "creator";
  const html = render({ ...post, files: [{ id: "video", kind: "MAIN", mime_type: "video/mp4", url: "/video.mp4" }] });
  assert.match(html, /<video.*controls/);
  assert.doesNotMatch(html, /type="file"|Replace video/);
});

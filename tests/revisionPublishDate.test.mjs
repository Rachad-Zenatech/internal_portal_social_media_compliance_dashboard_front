import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
function load(path, imports) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const context = { exports: {}, require: name => imports[name] ?? require(name) };
  vm.runInNewContext(outputText, context);
  return context.exports;
}
const timezone = load("../src/lib/userTimezone.ts", {});
const dates = load("../src/lib/userDates.ts", { "./userTimezone": timezone });
const zoneHook = load("../src/hooks/useUserTimezone.ts", { "@/lib/userTimezone": timezone });
const timing = load("../src/hooks/useRevisionPublishing.ts", {
  "@/lib/userDates": dates, "@/hooks/useUserTimezone": zoneHook,
  sonner: { toast: { error() {} } },
});
const { default: Requirements } = load("../src/components/submissions/RevisionCheckRequirements.tsx", {
  "@/components/ui/button": { Button: ({ children, onClick, ...props }) => React.createElement("button", props, children) },
});
let dateProps, checkboxProps, publishProps;
const dialog = new Proxy({}, { get: (_, name) => name === "__esModule" ? true : () => null });
const { default: Actions } = load("../src/components/submissions/RevisionPublishActions.tsx", {
  "@/lib/userDates": dates,
  "@/hooks/useRevisionPublishing": timing,
  "@/components/submissions/RevisionCheckRequirements": { __esModule: true, default: Requirements },
  "@/components/ui/date-time-picker": { DateTimePicker: props => { dateProps = props; return React.createElement("input", { disabled: props.disabled }); } },
  "@/components/ui/checkbox": { Checkbox: props => { checkboxProps = props; return null; } },
  "@/components/ui/alert-dialog": dialog,
  "@/components/submissions/PrePublishMood": { __esModule: true, default: () => null },
  "@/components/submissions/PublishPostButton": { __esModule: true, default: props => { publishProps = props; return null; } },
});
const future = new Date(Date.now() + 86400000 * 3);
function render(extra = {}) {
  dateProps = checkboxProps = publishProps = undefined;
  renderToStaticMarkup(React.createElement(Actions, { submissionId: "post", platform: "LINKEDIN", onPublishDateChange() {}, beforeMoodCheck: async () => {}, onSubmit() {}, disabled: true, submitting: false, dateError: false, ...extra }));
}

test("missing checks and an empty date do not lock the date picker", () => {
  let chosen;
  render({ onPublishDateChange: value => { chosen = value; } });
  assert.equal(dateProps.disabled, false);
  assert.equal(dateProps.disablePast, true);
  assert.equal(publishProps.disabled, true);
  dateProps.onChange("2030-12-01T15:30");
  assert.equal(chosen.getFullYear(), 2030);
  assert.equal(chosen.getHours(), 15);
});

test("intended-date confirmation stays editable while checks block publishing", () => {
  render({ publishDate: future, intended: future.toISOString() });
  assert.equal(dateProps.disabled, false);
  assert.equal(checkboxProps.disabled, false);
  assert.equal(publishProps.disabled, true);
});

test("active submission locks timing, while a valid ready date permits publishing", () => {
  render({ submitting: true, publishDate: future, intended: future.toISOString() });
  assert.equal(dateProps.disabled, true);
  assert.equal(checkboxProps.disabled, true);
  assert.equal(publishProps.disabled, true);
  render({ disabled: false, publishDate: future });
  assert.equal(dateProps.disabled, false);
  assert.equal(publishProps.disabled, false);
});

test("blocked publishing explains the required checks and offers direct navigation", () => {
  const output = renderToStaticMarkup(React.createElement(Requirements, { required: ["compliance", "sentiment"], busy: false, onOpen() {} }));
  assert.match(output, /Before you can publish/);
  assert.match(output, /latest content changes/);
  assert.match(output, /Go to compliance/);
  assert.match(output, /Go to sentiment/);
  assert.match(output, /Your publish date stays selected/);
  const textPost = renderToStaticMarkup(React.createElement(Requirements, { required: ["compliance"], busy: false, onOpen() {} }));
  assert.doesNotMatch(textPost, /sentiment/);
  assert.equal(renderToStaticMarkup(React.createElement(Requirements, { required: [], busy: false })), "");
});

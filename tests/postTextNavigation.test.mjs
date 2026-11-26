import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";

const browser = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
const page = ts.createSourceFile("page.tsx", readFileSync(new URL("../src/pages/Submissions/NewSubmissionPage.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let initializer;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(page) === "buildPayload") initializer = node.initializer.getText(page);
  ts.forEachChild(node, visit);
}
visit(page);
assert.ok(initializer, "exercise the actual draft payload builder");
const { outputText } = ts.transpileModule(`const buildPayload = ${initializer};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } });

test("saving from details or hidden compliance preserves unchanged text and formatting", { skip: !browser }, () => {
  const folder = mkdtempSync(join(tmpdir(), "post-navigation-"));
  const code = `try {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.innerHTML = '<p>First <strong>paragraph</strong>.</p><p>Visit <a href="https://example.com">our site</a>.</p>';
    document.body.append(editor);
    const original = editor.innerText;
    const context = { publishDate: null, approvalBy: null, accountIds: [], brands: [], audiences: [], title: 'Example', contentType: 'TEXT_POST', region: 'Global', platforms: [], editorRef: { current: editor }, caption: original, platformCaptions: {}, sourceLinks: [], aiGeneratedImages: null, imageProvenancePayload: () => ({}), resolveRuleSets: () => [], ruleSets: [], reviewers: [], pickedReviewers: [] };
    const save = new Function('context', ${JSON.stringify('with(context) { ' + outputText + ' return buildPayload(); }')});
    const visible = save(context);
    editor.style.display = 'none';
    if (editor.innerText === original) throw Error('fixture must reproduce browser hidden-text differences');
    const hidden = save(context);
    editor.style.display = 'block';
    const returned = save(context);
    if (JSON.stringify(visible) !== JSON.stringify(hidden) || JSON.stringify(visible) !== JSON.stringify(returned)) throw Error('navigation changed saved inputs');
    context.caption = 'Actually edited text';
    if (save(context).caption_text !== context.caption) throw Error('real edits were lost');
    context.caption = '';
    if (save(context).caption_text !== '') throw Error('clearing text was lost');
    document.body.textContent = 'NAVIGATION_PASS';
  } catch (error) { document.body.textContent = 'NAVIGATION_FAIL:' + error.stack; }`;
  writeFileSync(join(folder, "test.js"), code);
  writeFileSync(join(folder, "index.html"), '<!doctype html><body><script src="test.js"></script>');
  try {
    const result = spawnSync(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', '--disable-background-networking', `--user-data-dir=${join(folder, 'profile')}`, '--dump-dom', pathToFileURL(join(folder, 'index.html')).href], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
    assert.equal(result.status, 0, result.error?.message || result.stderr);
    assert.match(result.stdout, /NAVIGATION_PASS/, result.stdout);
  } finally {
    try { rmSync(folder, { recursive: true, force: true, maxRetries: 3 }); } catch { /* Chrome may briefly retain its profile lock. */ }
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";

const browser = [process.env.CAPTION_TEST_BROWSER,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/chromium", "/usr/bin/google-chrome"].find((path) => path && existsSync(path));

function compile(name, dependency) {
  const source = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023,
  } });
  return `(function(){const module={exports:{}};const exports=module.exports;const require=()=>(${dependency});${outputText};return module.exports;})()`;
}

test("caption rich text, wrapping, highlights and sanitization in a real browser DOM", { skip: !browser }, () => {
  const folder = mkdtempSync(join(tmpdir(), "caption-dom-test-"));
  const code = `const sanitize=${compile("sanitizeHtml", "undefined")};
    const {captionPreviewHtml: format}=${compile("captionPreviewHtml", "sanitize")};
    let passed=0;const check=(value,label)=>{if(!value)throw Error(label);passed++};
    const part=(text,tone='')=>({text,tone});
    try {
      const html=${JSON.stringify("From\nbattlefield rescue drones.<br><br>Explore our site.")};
      const output=format(html,[part(${JSON.stringify("From\nbattlefield rescue drones.\n\nExplore our site.")})]);
      check(output!==null,'pasted source wraps accepted');
      const preview=document.createElement('div');preview.style.cssText='white-space:normal;width:600px;font:16px Arial';
      preview.innerHTML=output;document.body.append(preview);
      const first=preview.firstChild;
      const lineAt=(index)=>{const range=document.createRange();range.setStart(first,index);range.setEnd(first,index+1);return range.getBoundingClientRect().top};
      check(lineAt(0)===lineAt(5),'HTML source newline must not split From from battlefield');
      check(preview.querySelectorAll('br').length===2,'intentional paragraph break preserved');
      const highlighted=format('<p>Unmanned <strong>rescue</strong> systems.</p><p><a href="https://example.com">Explore</a></p>',
        [part('Unmanned rescue systems.','chosen'),part(String.fromCharCode(10)+'Explore')]);
      preview.innerHTML=highlighted;
      check(preview.querySelectorAll('p').length===2,'paragraph structure preserved');
      check(preview.querySelector('strong mark')?.textContent==='rescue','highlight spans bold boundaries');
      check([...preview.querySelectorAll('mark')].every(mark=>mark.className.includes('bg-red-200')),'selected highlight preserved');
      check(preview.querySelector('a').getAttribute('href')==='https://example.com','safe link preserved');
      const unsafe=format('<p onclick="alert(1)">Safe <a href="javascript:alert(1)">text</a><img src=x onerror="alert(1)"></p><script>alert(1)</script>',[part('Safe text')]);
      check(unsafe!==null&&!/onclick|onerror|javascript:|<script|<img/.test(unsafe),'untrusted HTML sanitized before highlighting');
      check(format('<p>Old words</p>',[part('New words')])===null,'stale saved HTML cannot replace newer caption');
      check(format('',[part('First'+String.fromCharCode(10)+'Second')])===null,'plain text keeps its existing fallback');
      const escaped=format('<p>Cost is $5 (estimate).</p>',[part('Cost is '),part('$5 (estimate).','flag')]);
      preview.innerHTML=escaped;
      check(preview.querySelector('mark')?.textContent==='$5 (estimate).','literal punctuation highlights correctly');
      document.body.textContent='CAPTION_TEST_PASS:'+passed;
    } catch(error) {document.body.textContent='CAPTION_TEST_FAIL:'+error.stack;}`;
  writeFileSync(join(folder, "fixture.js"), code);
  const syntax = spawnSync(process.execPath, ["--check", join(folder, "fixture.js")], { encoding: "utf8", windowsHide: true });
  assert.equal(syntax.status, 0, syntax.stderr);
  writeFileSync(join(folder, "index.html"), '<!doctype html><meta charset="utf-8"><body><script>window.onerror=function(message){document.body.textContent="CAPTION_SCRIPT_ERROR:"+message;};</script><script src="fixture.js"></script></body>');
  try {
    const result = spawnSync(browser, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions",
      "--disable-background-networking", `--user-data-dir=${join(folder, "profile")}`, "--dump-dom",
      pathToFileURL(join(folder, "index.html")).href], { encoding: "utf8", windowsHide: true, timeout: 30_000 });
    assert.equal(result.status, 0, result.error?.message || result.stderr);
    assert.match(result.stdout, /CAPTION_TEST_PASS:11/, result.stdout);
  } finally {
    assert.equal(resolve(dirname(folder)), resolve(tmpdir()));
    assert.ok(basename(folder).startsWith("caption-dom-test-"));
    try { rmSync(folder, { recursive: true, force: true, maxRetries: 3 }); } catch { /* Browser may briefly retain a profile lock. */ }
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { build } from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL("../", import.meta.url));
const browser = [process.env.CAPTION_TEST_BROWSER, "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/chromium", "/usr/bin/google-chrome"].find(path => path && existsSync(path));

test("returned captions and text posts show original and incoming rich text with highlighted differences", { skip: !browser, timeout: 60000 }, async () => {
  const fixture = mkdtempSync(join(root, "tests", ".incoming-text-"));
  const output = mkdtempSync(join(tmpdir(), "incoming-text-test-"));
  try {
    writeFileSync(join(fixture, "main.tsx"), String.raw`
import React from 'react';
import { createRoot } from 'react-dom/client';
import IncomingTextComparison from '../../src/components/submissions/IncomingTextComparison';
const change={key:'main',label:'Main text',authors:['Reviewer A','Reviewer B'],before:'Old claim.Visit report.',after:'New claim.\n\nVisit report.',
 beforeHtml:'<p><strong>Old claim.</strong></p><p><a href="https://example.com/report">Visit report.</a></p>',
 afterHtml:'<p><strong>New claim.</strong></p><p><br></p><p><a href="https://example.com/report">Visit report.</a></p>'};
createRoot(document.getElementById('root')).render(<IncomingTextComparison change={change}/>);
setTimeout(()=>{try{
 const before=document.querySelector('section[aria-label="Your original text"]');
 const after=document.querySelector('section[aria-label="Incoming reviewer text"]');
 const check=(value,message)=>{if(!value)throw Error(message)};
 check(before&&after,'Both versions must be visible');
 check(before.querySelector('strong')?.textContent==='Old claim.','Original bold formatting was lost');
 check(after.querySelector('strong')?.textContent==='New claim.','Incoming bold formatting was lost');
 check(before.querySelector('a')?.href==='https://example.com/report','Original link was lost');
 check(after.querySelector('p br'),'Incoming blank paragraph was lost');
 const details=document.querySelector('details');details.open=true;
 check(details.querySelector('del')?.textContent.includes('Old'),'Missing removed wording');
 check(details.querySelector('ins')?.textContent.includes('New'),'Missing added wording');
 check(!document.querySelector('textarea,[contenteditable="true"]'),'Comparison must remain read-only');
 document.body.innerHTML='<pre>INCOMING_TEXT_PASS</pre>';
}catch(error){document.body.textContent='INCOMING_TEXT_FAIL:'+error.stack}},100);
`);
    await build({ configFile: false, root, logLevel: "silent", plugins: [react()], define: { "process.env.NODE_ENV": JSON.stringify("production") }, resolve: { alias: { "@": join(root, "src") } },
      build: { outDir: join(output, "bundle"), emptyOutDir: true, minify: false,
        lib: { entry: join(fixture, "main.tsx"), name: "IncomingTextTest", formats: ["iife"], fileName: () => "fixture.js" } } });
    writeFileSync(join(output, "index.html"), '<!doctype html><meta charset="utf-8"><div id="root"></div><script>window.onerror=(message)=>{document.body.textContent="INCOMING_SCRIPT_FAIL:"+message};</script><script src="bundle/fixture.js"></script>');
    mkdirSync(join(output, "profile"));
    const result = spawnSync(browser, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", "--disable-background-networking",
      "--virtual-time-budget=10000", `--user-data-dir=${join(output, "profile")}`, "--dump-dom", pathToFileURL(join(output, "index.html")).href],
      { encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 2_000_000 });
    assert.equal(result.status, 0, result.error?.message || result.stderr);
    assert.match(result.stdout, /INCOMING_TEXT_PASS/, result.stdout);
  } finally {
    assert.equal(resolve(dirname(fixture)), resolve(root, "tests"));
    assert.equal(resolve(dirname(output)), resolve(tmpdir()));
    assert.ok(basename(fixture).startsWith(".incoming-text-") && basename(output).startsWith("incoming-text-test-"));
    rmSync(fixture, { recursive: true, force: true });
    try { rmSync(output, { recursive: true, force: true, maxRetries: 3 }); } catch { /* Chrome can briefly retain a profile lock. */ }
  }
});

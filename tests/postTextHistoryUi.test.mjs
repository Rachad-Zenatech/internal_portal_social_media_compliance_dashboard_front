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

test("creators browse saved text versions and comparisons while reviewers retain editing", { skip: !browser, timeout: 60000 }, async () => {
  const fixture = mkdtempSync(join(root, "tests", ".post-text-ui-"));
  const output = mkdtempSync(join(tmpdir(), "post-text-ui-test-"));
  try {
    writeFileSync(join(fixture, "main.tsx"), String.raw`
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PostTextReview from '../../src/components/submissions/PostTextReview';
import ReviewerComplianceRecheck from '../../src/components/compliance/screener/ReviewerComplianceRecheck';
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
const now='2026-11-25T14:00:00Z';
let edits=[{id:'101',reviewer_name:'Alice',created_at:now,version:1,before_text:'Original post text.',after_text:'First reviewer text.'},{id:'102',reviewer_name:'Bob',created_at:now,version:1,before_text:'First reviewer text.',after_text:'Approved reviewer text.'}];
let current='Approved reviewer text.',saves=0,checks=0;
const check=(ok,message)=>{if(!ok)throw Error(message)};
const until=async(fn)=>{for(let n=0;n<200;n++){if(fn())return;await new Promise(r=>setTimeout(r,20))}throw Error('UI did not reach expected state')};
window.fetch=async(input,init={})=>{
 const url=typeof input==='string'?input:input.url;
 if(init.method==='POST' && url.endsWith('/check')){ checks++;return new Response(JSON.stringify({id:'reviewer',latest_check:{score:100}}),{status:200,headers:{'Content-Type':'application/json'}}); }
 if(init.method==='POST'){
  const body=JSON.parse(init.body);check(body.base_text===current&&body.base_revision==='102','Save lost its exact base version');
  saves++;edits=[...edits,{id:'103',reviewer_name:'Carol',created_at:now,version:1,before_text:current,after_text:body.text}];current=body.text;
 }
 return new Response(JSON.stringify({text:current,revision:edits.at(-1).id,can_edit:url.includes('/reviewer/'),edits}),{status:200,headers:{'Content-Type':'application/json'}});
};
const root=createRoot(document.getElementById('root'));
const show=(id,allowEdit=false)=>root.render(<QueryClientProvider client={client}><div data-post={id}><PostTextReview key={id} submissionId={id} allowEdit={allowEdit} reviewerView={allowEdit} renderText={allowEdit ? (text) => <p>{text}</p> : undefined}/><ReviewerComplianceRecheck submissionId={id} canRun={allowEdit}/></div></QueryClientProvider>);
const button=label=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===label);
const saved=()=>document.querySelector('[aria-label="Saved post text"]');
const select=value=>{const el=document.querySelector('select');el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}))};
(async()=>{
 try{
  for(const state of ['APPROVED','CHANGES_REQUESTED']){
   show(state);await until(()=>document.querySelector('[data-post="'+state+'"] [aria-label="Saved post text"]'));
   check(saved().textContent===current,'Creator cannot see saved text after '+state);
   check(!button('Edit post text')&&!document.querySelector('[contenteditable="true"]'),'Creator received reviewer editing access');
   check(document.body.textContent.includes('Reviewer revision 1')&&document.body.textContent.includes('Reviewer revision 2'),'Edits in one review round need distinct revision labels');
   select('101');await until(()=>saved().textContent==='First reviewer text.');
   select('before');await until(()=>saved().textContent==='Original post text.');
   select('current');await until(()=>saved().textContent===current);
   button('Compare').click();await until(()=>document.querySelector('[role="dialog"]'));
   check(document.querySelector('[aria-label="Post text before changes"]').textContent.includes('First reviewer text.'),'Before version missing');
   check(document.querySelector('[aria-label="Post text after changes"]').textContent.includes('Approved reviewer text.'),'After version missing');
   check(document.querySelector('del')&&document.querySelector('ins'),'Changes lack highlights');
   button('Close').click();await until(()=>!document.querySelector('[role="dialog"]'));
   check(saves===0,'Browsing versions must not save or restore older text');
  }
  show('reviewer',true);await until(()=>button('Edit text'));
  check(!button('Run compliance check'),'Unchanged text should not show a text-edit recheck');
  check(button('Recheck compliance'),'Compliance panel must offer manual rechecking');
  button('Recheck compliance').click();
  await until(()=>checks===1&&button('Recheck compliance')&&!button('Recheck compliance').disabled);
  check(document.querySelectorAll('[aria-label="Saved post text"]').length===1,'Reviewer text preview is duplicated');
  check(document.body.textContent.split(current).length===2,'Current text should appear only once');
  check(!document.querySelector('select'),'Reviewer should use change history rather than a duplicate version preview');
  check(document.body.textContent.includes('Reviewer revision 2'),'Reviewer history is missing');
  button('Edit text').click();await until(()=>document.querySelector('[contenteditable="true"]'));
  const input=document.querySelector('[contenteditable="true"]');input.textContent='New reviewer text.';input.dispatchEvent(new Event('input',{bubbles:true}));
  await until(()=>!button('Save text changes').disabled);
  const changes=document.querySelector('[aria-label="Unsaved text changes"]');
  check(input.compareDocumentPosition(button('Save text changes'))&Node.DOCUMENT_POSITION_FOLLOWING,'Save must follow the editor');
  check(button('Save text changes').compareDocumentPosition(changes)&Node.DOCUMENT_POSITION_FOLLOWING,'Unsaved change preview must follow Save and Cancel');
  check(changes.compareDocumentPosition(document.querySelector('[aria-label="Reviewer text change history"]'))&Node.DOCUMENT_POSITION_FOLLOWING,'Saved versions must follow the action buttons and draft preview');
  button('Save text changes').click();
  await until(()=>saves===1&&!document.querySelector('[contenteditable="true"]'));
  check(saved().textContent==='New reviewer text.','Reviewer save did not update the visible version');
  check(document.body.textContent.includes('Reviewer revision 3'),'New reviewer edit lost its history');
  await until(()=>button('Run compliance check'));
  check(checks===1,'Saving text must not invoke AI automatically');
  button('Run compliance check').click();
  await until(()=>checks===2&&!button('Run compliance check'));
  check(saved().textContent==='New reviewer text.','Rechecking must preserve the edited text');
  document.body.innerHTML='<pre>POST_TEXT_UI_PASS</pre>';
 }catch(error){document.body.innerHTML='';const pre=document.createElement('pre');pre.textContent='POST_TEXT_UI_FAIL:'+error.stack;document.body.append(pre)}
})();`);
    await build({ configFile: false, root, logLevel: "silent", plugins: [react()], define: { "process.env.NODE_ENV": JSON.stringify("production") }, resolve: { alias: { "@": join(root, "src") } },
      build: { outDir: join(output, "bundle"), emptyOutDir: true, minify: false,
        lib: { entry: join(fixture, "main.tsx"), name: "PostTextUiTest", formats: ["iife"], fileName: () => "fixture.js" } } });
    writeFileSync(join(output, "index.html"), '<!doctype html><meta charset="utf-8"><div id="root"></div><script>window.onerror=(message)=>{document.body.textContent="CAPTION_SCRIPT_FAIL:"+message};</script><script src="bundle/fixture.js"></script>');
    mkdirSync(join(output, "profile"));
    const result = spawnSync(browser, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", "--disable-background-networking",
      "--virtual-time-budget=10000", `--user-data-dir=${join(output, "profile")}`, "--dump-dom", pathToFileURL(join(output, "index.html")).href],
      { encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 2_000_000 });
    assert.equal(result.status, 0, result.error?.message || result.stderr);
    const failure = result.stdout.match(/POST_TEXT_UI_FAIL:[\s\S]*?<\/pre>/)?.[0];
    assert.match(result.stdout, /POST_TEXT_UI_PASS/, failure || result.stdout.slice(-3000));
  } finally {
    assert.equal(resolve(dirname(fixture)), resolve(root, "tests"));
    assert.equal(resolve(dirname(output)), resolve(tmpdir()));
    assert.ok(basename(fixture).startsWith(".post-text-ui-") && basename(output).startsWith("post-text-ui-test-"));
    rmSync(fixture, { recursive: true, force: true });
    try { rmSync(output, { recursive: true, force: true, maxRetries: 3 }); } catch { /* Chrome can briefly retain a profile lock. */ }
  }
});

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

test("caption UI saves, cancels, compares, and rejects stale refreshes in a real browser", { skip: !browser, timeout: 60000 }, async () => {
  const fixture = mkdtempSync(join(root, "tests", ".caption-ui-"));
  const output = mkdtempSync(join(tmpdir(), "caption-ui-test-"));
  try {
    writeFileSync(join(fixture, "main.tsx"), String.raw`
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReviewerCaption from '../../src/components/compliance/screener/ReviewerCaption';
import MarkedReviewerCaption from '../../src/components/compliance/screener/MarkedReviewerCaption';
const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
let data = {caption_text:'Old caption.',caption_html:'<p>Old <strong>caption</strong>.</p>',platforms:['FACEBOOK'],platform_captions:{},can_edit:true,needs_recheck:false,revisions:[]};
let saves=0, abortedGets=0, pauseNextGet=false, waitingGet=false;
window.fetch = async (input, init={}) => {
  if(!String(input).includes('/caption-review')) throw Error('Unexpected network request was blocked');
  if(init.method==='PATCH') {
    const body=JSON.parse(init.body);
    if(body.base_caption!=='Old caption.' || body.caption_text!=='New caption.') throw Error('Incorrect caption save payload');
    saves++;
    data={...data,caption_text:body.caption_text,caption_html:'<p>New caption.</p>',needs_recheck:true,revisions:[{
      id:1,before:'Old caption.',after:'New caption.',platform:null,version:1,actor_id:'reviewer',actor_name:'Arifa Mansoor',created_at:'2026-11-24T20:00:00Z'
    }]};
  } else if(pauseNextGet) {
    pauseNextGet=false;waitingGet=true;
    await new Promise((_,reject)=>init.signal.addEventListener('abort',()=>{abortedGets++;reject(new DOMException('Aborted','AbortError'))},{once:true}));
  }
  return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
};
const check=(condition,message)=>{if(!condition)throw Error(message)};
const until=async(predicate)=>{for(let i=0;i<200;i++){if(predicate())return;await new Promise(r=>setTimeout(r,20))}throw Error('Timed out waiting for UI')};
const button=(label)=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===label);
const type=(value)=>{const el=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))};
createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}>
  <ReviewerCaption submissionId="post" canComment captionText="Old caption.">{(text,html,showFlags)=><MarkedReviewerCaption text={text} html={html} terms={showFlags?[{term:'caption',ruleId:'rule-18',dismissed:false}]:[]} picked={null} onFlag={id=>document.body.dataset.flag=id} onComment={()=>{}}/>}</ReviewerCaption>
</QueryClientProvider>);
(async()=>{
  try {
    await until(()=>button('Edit caption'));
    check(document.querySelector('strong mark')?.textContent==='caption','Formatted clickable highlight is missing');
    document.querySelector('mark').click();check(document.body.dataset.flag==='rule-18','Rule highlight does not open its finding');
    button('Edit caption').click();await until(()=>document.querySelector('textarea'));
    type('New caption.');await until(()=>!button('Save changes').disabled);
    pauseNextGet=true;void client.invalidateQueries({queryKey:['caption-review','post']});await until(()=>waitingGet);
    button('Save changes').click();await until(()=>saves===1&&!document.querySelector('textarea'));
    check(abortedGets===1,'Older polling request was not cancelled before saving');
    check(document.querySelector('[aria-label="Caption"]').textContent.includes('New caption.'),'Saved caption is not shown');
    check(!document.querySelector('mark'),'Old compliance highlights should wait for a new check');
    const history=document.querySelector('details');check(history,'Edit history is missing');history.open=true;
    check(history.textContent.includes('Arifa Mansoor'),'Edit author is missing');
    button('Compare').click();await until(()=>document.querySelector('[role="dialog"]'));
    const dialog=document.querySelector('[role="dialog"]');
    check(dialog.querySelector('[aria-label="Caption before changes"]').textContent.includes('Old caption.'),'Previous caption is missing');
    check(dialog.querySelector('[aria-label="Caption after changes"]').textContent.includes('New caption.'),'Updated caption is missing');
    button('Close').click();await until(()=>!document.querySelector('[role="dialog"]'));
    button('Edit caption').click();await until(()=>document.querySelector('textarea'));
    type('   ');await until(()=>button('Save changes').disabled);
    button('Cancel').click();await until(()=>!document.querySelector('textarea'));
    check(saves===1,'Cancel must not save a second edit');
    document.body.innerHTML='<pre>CAPTION_UI_PASS</pre>';
  }catch(error){document.body.innerHTML='';const pre=document.createElement('pre');pre.textContent='CAPTION_UI_FAIL:'+error.stack;document.body.append(pre)}
})();`);
    await build({ configFile: false, root, logLevel: "silent", plugins: [react()], define: { "process.env.NODE_ENV": JSON.stringify("production") }, resolve: { alias: { "@": join(root, "src") } },
      build: { outDir: join(output, "bundle"), emptyOutDir: true, minify: false,
        lib: { entry: join(fixture, "main.tsx"), name: "CaptionUiTest", formats: ["iife"], fileName: () => "fixture.js" } } });
    writeFileSync(join(output, "index.html"), '<!doctype html><meta charset="utf-8"><div id="root"></div><script>window.onerror=(message)=>{document.body.textContent="CAPTION_SCRIPT_FAIL:"+message};</script><script src="bundle/fixture.js"></script>');
    mkdirSync(join(output, "profile"));
    const result = spawnSync(browser, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", "--disable-background-networking",
      "--virtual-time-budget=10000", `--user-data-dir=${join(output, "profile")}`, "--dump-dom", pathToFileURL(join(output, "index.html")).href],
      { encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 2_000_000 });
    assert.equal(result.status, 0, result.error?.message || result.stderr);
    assert.match(result.stdout, /CAPTION_UI_PASS/, result.stdout);
  } finally {
    assert.equal(resolve(dirname(fixture)), resolve(root, "tests"));
    assert.equal(resolve(dirname(output)), resolve(tmpdir()));
    assert.ok(basename(fixture).startsWith(".caption-ui-") && basename(output).startsWith("caption-ui-test-"));
    rmSync(fixture, { recursive: true, force: true });
    try { rmSync(output, { recursive: true, force: true, maxRetries: 3 }); } catch { /* Chrome can briefly retain a profile lock. */ }
  }
});

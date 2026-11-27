import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { build } from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL("../", import.meta.url));
const browser = "C:/Program Files/Google/Chrome/Application/chrome.exe";

test("video declaration requires an explicit answer, preserves No, reloads Yes and hides for images", { skip: !existsSync(browser), timeout: 60000 }, async () => {
  const fixture = mkdtempSync(join(root, "tests", ".video-footage-ui-"));
  const output = mkdtempSync(join(tmpdir(), "video-footage-ui-test-"));
  try {
    writeFileSync(join(fixture, "main.tsx"), String.raw`
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import VideoFootageField from '../../src/components/submissions/VideoFootageField';
import {useVideoFootageDeclaration} from '../../src/hooks/useVideoFootageDeclaration';
const video=[{kind:'MAIN',mime_type:'video/mp4'}];
function Fixture({initial={id:'post'},files=video,disabled=false}){
 const[post,setPost]=useState(initial);const field=useVideoFootageDeclaration(post,files);
 return <><VideoFootageField {...field} disabled={disabled} invalid={field.missing}/><output>{JSON.stringify({missing:field.missing,value:field.value,changed:field.changed})}</output><button onClick={()=>{window.saved=field.payload;setPost({...post,...field.payload})}}>Save</button><button onClick={()=>setPost({id:'post',...window.saved})}>Load draft</button></>;
}
const node=document.getElementById('root');let root=createRoot(node);root.render(<Fixture initial={null} files={[]}/>);
const wait=()=>new Promise(resolve=>setTimeout(resolve,20));
const until=async condition=>{for(let i=0;i<150;i++){if(condition())return;await wait();}throw Error('Timed out: '+condition.toString());};
const check=(condition,message)=>{if(!condition)throw Error(message);};
const state=()=>JSON.parse(document.querySelector('output').textContent);
const radio=label=>[...document.querySelectorAll('label')].find(element=>element.textContent===label).querySelector('input');
(async()=>{try{
 await until(()=>document.querySelector('output'));
 check(state().value===null&&!state().changed&&!state().missing,'Blank post state is invalid');
 check(!document.querySelector('fieldset'),'Blank page asks a video question before upload');
 [...document.querySelectorAll('button')].find(button=>button.textContent==='Load draft').click();
 await until(()=>document.querySelector('output')&&state().value===null);
 root.unmount();root=createRoot(node);root.render(<Fixture/>);
 await until(()=>document.querySelector('output'));
 check(state().missing&&!document.querySelector('input:checked'),'Question silently defaults to No');
 radio('No').click();await until(()=>state().value===false);
 document.querySelector('button').click();await until(()=>window.saved?.video_third_party_footage===false&&!state().changed);
 radio('Yes').click();await until(()=>state().value===true);
 check(document.querySelector('strong').textContent.includes('This video may include stock, third-party or AI-generated footage.'),'Approved wording is missing');
 document.querySelector('button').click();await until(()=>window.saved.video_third_party_footage===true&&!state().changed);
 root.unmount();root=createRoot(node);root.render(<Fixture initial={{id:'post',...window.saved}} disabled/>);
 await until(()=>document.querySelector('output'));
 check(state().value===true&&radio('Yes').checked,'Saved Yes was lost on reload');
 check(radio('Yes').matches(':disabled'),'Read-only declaration is editable');
 root.unmount();root=createRoot(node);root.render(<Fixture initial={null}/>);
 await until(()=>document.querySelector('output'));
 check(state().value===null,'Existing page cannot start in a loading state');
 [...document.querySelectorAll('button')].find(button=>button.textContent==='Load draft').click();
 await until(()=>state().value===true);
 check(radio('Yes').checked,'Saved answer was lost when the post finished loading');
 root.unmount();root=createRoot(node);root.render(<Fixture files={[{kind:'MAIN',mime_type:'image/png'}]}/>);
 await until(()=>document.querySelector('output'));
 check(!document.querySelector('fieldset')&&!state().missing,'Image posts are being asked a video question');
 document.body.innerHTML='<pre>VIDEO_FOOTAGE_UI_PASS</pre>';
}catch(error){document.body.innerHTML='';const pre=document.createElement('pre');pre.textContent='VIDEO_FOOTAGE_UI_FAIL: '+error.stack;document.body.append(pre);}})();
`);
    await build({ configFile: false, root, logLevel: "silent", define: { "process.env.NODE_ENV": '"production"' }, plugins: [react()],
      resolve: { alias: { "@": resolve(root, "src") } }, build: { outDir: join(output, "bundle"), emptyOutDir: true, minify: false,
        lib: { entry: join(fixture, "main.tsx"), name: "VideoFootageTest", formats: ["iife"], fileName: () => "fixture.js" } } });
    const bundle = readFileSync(join(output, "bundle", "fixture.js"), "utf8").replaceAll("</script", "<\\/script");
    writeFileSync(join(output, "index.html"), '<!doctype html><meta charset="utf-8"><div id="root"></div><script>window.onerror=(message,url,line,col,error)=>{document.body.textContent="VIDEO_FOOTAGE_SCRIPT_FAIL:"+(error?.stack||message)};</script><script>' + bundle + '</script>');
    mkdirSync(join(output, "profile"));
    const result = spawnSync(browser, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", "--disable-background-networking",
      "--virtual-time-budget=10000", `--user-data-dir=${join(output, "profile")}`, "--dump-dom", pathToFileURL(join(output, "index.html")).href],
      { encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 2_000_000 });
    assert.equal(result.status, 0, result.error?.message || result.stderr);
    assert.ok(result.stdout.includes('<pre>VIDEO_FOOTAGE_UI_PASS</pre>'), result.stdout.slice(-3000));
  } finally {
    assert.equal(resolve(dirname(fixture)), resolve(root, "tests"));
    assert.equal(resolve(dirname(output)), resolve(tmpdir()));
    assert.ok(basename(fixture).startsWith(".video-footage-ui-") && basename(output).startsWith("video-footage-ui-test-"));
    rmSync(fixture, { recursive: true, force: true });
    try { rmSync(output, { recursive: true, force: true, maxRetries: 3 }); } catch { /* Chrome may briefly retain its profile lock. */ }
  }
});

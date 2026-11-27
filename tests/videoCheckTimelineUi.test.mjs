import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const browser = "C:/Program Files/Google/Chrome/Application/chrome.exe";

test("zero-duration green markers render at narrow widths and playback controls work", { skip: !existsSync(browser), timeout: 60000 }, async () => {
  const fixture = mkdtempSync(join(root, "tests", ".video-timeline-ui-"));
  const output = mkdtempSync(join(tmpdir(), "video-timeline-ui-test-"));
  try {
    writeFileSync(join(fixture, "main.tsx"), String.raw`
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {FlaggedMoments} from '../../src/components/video/VideoCheckTimeline';
import '../../src/index.css';
const parts=Array.from({length:14},(_,i)=>({start:i*5,end:i*5,risk:'GREEN'}));
let seeks=0,steps=0;
function Fixture(){const[now,setNow]=useState(0);const[playing,setPlaying]=useState(false);return <FlaggedMoments parts={parts} now={now} duration={70} playing={playing} onToggle={()=>setPlaying(value=>!value)} onStep={by=>{steps++;setNow(value=>value+by)}} seek={time=>{seeks++;setNow(time)}}/>;}
createRoot(document.getElementById('root')).render(<Fixture/>);
const wait=()=>new Promise(resolve=>setTimeout(resolve,20));
const until=async condition=>{for(let i=0;i<180;i++){if(condition())return;await wait();}throw Error('Timed out: '+condition.toString());};
const check=(condition,message)=>{if(!condition)throw Error(message);};
(async()=>{try{
 await until(()=>document.querySelector('[aria-label="Video check timeline"]'));
 const root=document.getElementById('root');
 for(const width of [280,340,420]){
   root.style.width=width+'px';await wait();
   const panel=document.querySelector('section');
   check(panel.scrollWidth<=panel.clientWidth+1,'Timeline overflows at '+width+'px');
   const track=document.querySelector('[data-testid="video-check-track"]');
   check(track.getBoundingClientRect().width>width-35,'Track is squeezed by playback controls');
   const markers=[...track.querySelectorAll('[data-risk="GREEN"]')];
   check(markers.length===14,'Clear observations are missing');
   for(const marker of markers){
     check(marker.getBoundingClientRect().width>=3.9,'Zero-length sample is invisible');
     const color=getComputedStyle(marker).backgroundColor;
     check(color!=='rgba(0, 0, 0, 0)'&&color!=='transparent','Green style is missing');
   }
   check(panel.textContent.includes('Clear (14)'),'Clear count is missing');
   check(panel.textContent.includes('grey gaps are not marked clear'),'Uninspected gaps are misrepresented');
 }
 document.querySelector('[title="Play"]').click();await until(()=>document.querySelector('[title="Pause"]'));
 document.querySelector('[title="Forward 1 second"]').click();await until(()=>steps===1&&document.body.textContent.includes('0:01'));
 const range=document.querySelector('[aria-label="Seek video"]');
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(range,'35');
 range.dispatchEvent(new Event('input',{bubbles:true}));range.dispatchEvent(new Event('change',{bubbles:true}));
 await until(()=>seeks>0&&document.body.textContent.includes('0:35'));
 document.body.innerHTML='<pre>VIDEO_TIMELINE_UI_PASS</pre>';
}catch(error){document.body.innerHTML='';const pre=document.createElement('pre');pre.textContent='VIDEO_TIMELINE_UI_FAIL: '+error.stack;document.body.append(pre);}})();
`);
    await build({ configFile: false, root, logLevel: "silent", define: { "process.env.NODE_ENV": '"production"' }, plugins: [react(), tailwindcss()],
      resolve: { alias: { "@": resolve(root, "src") } }, build: { outDir: join(output, "bundle"), emptyOutDir: true, minify: false,
        lib: { entry: join(fixture, "main.tsx"), name: "VideoTimelineTest", formats: ["iife"], fileName: () => "fixture.js" } } });
    const bundle = readFileSync(join(output, "bundle", "fixture.js"), "utf8").replaceAll("</script", "<\\/script");
    const css = readdirSync(join(output, "bundle")).filter(name => name.endsWith(".css")).map(name => readFileSync(join(output, "bundle", name), "utf8")).join("\n");
    writeFileSync(join(output, "index.html"), '<!doctype html><meta charset="utf-8"><style>' + css + '</style><div id="root"></div><script>window.onerror=(message,url,line,col,error)=>{document.body.textContent="VIDEO_TIMELINE_SCRIPT_FAIL:"+(error?.stack||message)};</script><script>' + bundle + '</script>');
    mkdirSync(join(output, "profile"));
    const result = spawnSync(browser, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", "--disable-background-networking",
      "--virtual-time-budget=10000", `--user-data-dir=${join(output, "profile")}`, "--dump-dom", pathToFileURL(join(output, "index.html")).href],
      { encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 2_000_000 });
    assert.equal(result.status, 0, result.error?.message || result.stderr);
    assert.ok(result.stdout.includes('<pre>VIDEO_TIMELINE_UI_PASS</pre>'), result.stdout.slice(-4000));
  } finally {
    assert.equal(resolve(dirname(fixture)), resolve(root, "tests"));
    assert.equal(resolve(dirname(output)), resolve(tmpdir()));
    assert.ok(basename(fixture).startsWith(".video-timeline-ui-") && basename(output).startsWith("video-timeline-ui-test-"));
    rmSync(fixture, { recursive: true, force: true });
    try { rmSync(output, { recursive: true, force: true, maxRetries: 3 }); } catch { /* Chrome can briefly retain its profile lock. */ }
  }
});

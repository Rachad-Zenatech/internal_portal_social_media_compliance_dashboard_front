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

test("profile zone changes update the picker without moving its selected instant or losing a draft", { skip: !existsSync(browser), timeout: 60000 }, async () => {
  const fixture = mkdtempSync(join(root, "tests", ".timezone-ui-"));
  const output = mkdtempSync(join(tmpdir(), "timezone-ui-test-"));
  try {
    writeFileSync(join(fixture, "auth.ts"), 'export const useAuth=()=>({user:{id:"timezone-test"}});');
    writeFileSync(join(fixture, "api.ts"), 'export const apiClient={put:async (_url,body)=>{window.savedZone=body;return body;}};');
    writeFileSync(join(fixture, "main.tsx"), String.raw`
import React from 'react';
import {createRoot} from 'react-dom/client';
import TimeZoneSettings from '../../src/components/AppShell/TimeZoneSettings';
import {DateTimePicker} from '../../src/components/ui/date-time-picker';
import {useFinalPublishDate} from '../../src/hooks/useFinalPublishDate';
import {activateTimezoneUser,applyTimezone} from '../../src/lib/userTimezone';
activateTimezoneUser('timezone-test');
applyTimezone('timezone-test',{time_zone:'America/Toronto',source:'MANUAL'});
function Fixture(){
 const timing=useFinalPublishDate('post','2030-11-26T22:00:00Z');
 return <><TimeZoneSettings/><textarea aria-label="Unsaved draft" defaultValue="Keep this draft"/><DateTimePicker aria-label="Publish date" value={timing.value} onChange={timing.onChange} withTime/><output>{timing.date?.getTime()}</output></>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
const wait=()=>new Promise(resolve=>setTimeout(resolve,20));
const until=async condition=>{for(let n=0;n<180;n++){if(condition())return;await wait();}throw Error('Timed out: '+condition.toString());};
const check=(condition,message)=>{if(!condition)throw Error(message);};
const button=text=>[...document.querySelectorAll('button')].find(element=>element.textContent.trim()===text);
(async()=>{try{
 await until(()=>document.querySelector('output'));
 const instant=document.querySelector('output').textContent;
 const draft=document.querySelector('textarea');
 const select=document.querySelector('#profile-timezone');
 select.value='Asia/Manila';select.dispatchEvent(new Event('change',{bubbles:true}));
 await until(()=>!button('Save time zone').disabled);button('Save time zone').click();
 await until(()=>document.querySelector('[aria-label="Publish date (Asia/Manila)"]'));
 check(window.savedZone.time_zone==='Asia/Manila'&&window.savedZone.source==='MANUAL','Manual choice was not persisted');
 check(document.querySelector('output').textContent===instant,'Changing zones moved the existing publish instant');
 check(document.querySelector('textarea')===draft&&draft.value==='Keep this draft','Changing zones remounted or lost an unsaved draft');
 const trigger=document.querySelector('[aria-label="Publish date (Asia/Manila)"]');
 check(trigger.textContent.includes('Nov 27')&&trigger.textContent.includes('6:00 AM'),'Picker did not convert Toronto to the next day in Manila');
 trigger.click();await until(()=>document.querySelector('[role="option"]'));
 const nine=[...document.querySelectorAll('[role="option"]')].find(option=>option.textContent.trim()==='9:00 AM');
 check(nine,'Time choices are missing');nine.click();
 await until(()=>document.querySelector('output').textContent!==instant);
 check(Number(document.querySelector('output').textContent)===Date.parse('2030-11-27T01:00:00Z'),'Picking 9 AM Manila used the browser zone');
 document.body.innerHTML='<pre>TIMEZONE_UI_PASS</pre>';
}catch(error){document.body.innerHTML='';const pre=document.createElement('pre');pre.textContent='TIMEZONE_UI_FAIL: '+error.stack;document.body.append(pre);}})();
`);
    await build({ configFile: false, root, logLevel: "silent", define: { "process.env.NODE_ENV": '"production"' }, plugins: [react()], resolve: { alias: [
      { find: "@/lib/AuthContext", replacement: join(fixture, "auth.ts") },
      { find: "@/services/apiClient", replacement: join(fixture, "api.ts") },
      { find: "@", replacement: resolve(root, "src") },
    ] }, build: { outDir: join(output, "bundle"), emptyOutDir: true, minify: false,
      lib: { entry: join(fixture, "main.tsx"), name: "TimezoneUiTest", formats: ["iife"], fileName: () => "fixture.js" } } });
    const bundle = readFileSync(join(output, "bundle", "fixture.js"), "utf8").replaceAll("</script", "<\\/script");
    writeFileSync(join(output, "index.html"), '<!doctype html><meta charset="utf-8"><div id="root"></div><script>window.onerror=(message,url,line,col,error)=>{document.body.textContent="TIMEZONE_SCRIPT_FAIL:"+(error?.stack||message)};</script><script>' + bundle + '</script>');
    mkdirSync(join(output, "profile"));
    const result = spawnSync(browser, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", "--disable-background-networking",
      "--virtual-time-budget=10000", `--user-data-dir=${join(output, "profile")}`, "--dump-dom", pathToFileURL(join(output, "index.html")).href],
      { encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 2_000_000 });
    assert.equal(result.status, 0, result.error?.message || result.stderr);
    assert.match(result.stdout, /TIMEZONE_UI_PASS/, result.stdout);
  } finally {
    assert.equal(resolve(dirname(fixture)), resolve(root, "tests"));
    assert.equal(resolve(dirname(output)), resolve(tmpdir()));
    assert.ok(basename(fixture).startsWith(".timezone-ui-") && basename(output).startsWith("timezone-ui-test-"));
    rmSync(fixture, { recursive: true, force: true });
    try { rmSync(output, { recursive: true, force: true, maxRetries: 3 }); } catch { /* Chrome can briefly retain its profile lock. */ }
  }
});

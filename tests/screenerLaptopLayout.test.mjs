import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const browser = [process.env.CAPTION_TEST_BROWSER,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/chromium", "/usr/bin/google-chrome"].find((path) => path && existsSync(path));
const source = readFileSync(new URL("../src/pages/Compliance/ContentScreenerPage.tsx", import.meta.url), "utf8");
const rootClass = source.match(/<div className="(screener-layout[^"]+)"/)[1];
const queueClass = source.match(/className={`(screener-queue[^$]+)/)[1];
const reviewClass = source.match(/className="(screener-review[^"]+)"/)[1];
const index = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const cssPath = index.match(/href="([^"]+\.css)"/)[1];
const pageCss = readdirSync(new URL("../dist/assets/", import.meta.url)).find(name => /^ContentScreenerPage-.*\.css$/.test(name));
assert.ok(pageCss, "Build the content screener before running its layout test");
const css = readFileSync(new URL(`../dist${cssPath}`, import.meta.url), "utf8")
  + readFileSync(new URL(`../dist/assets/${pageCss}`, import.meta.url), "utf8");

function fixture(collapsed) {
  return `<!doctype html><meta charset="utf-8"><style>${css}</style><style>
  body{margin:0;font-family:Arial,sans-serif} .shell{display:flex;height:100vh;width:100%}
  .navigation{width:248px;flex-shrink:0}.canvas{flex:1;min-width:0}.topbar{height:64px}.breadcrumbs{height:48px}main{padding:16px}
  @media(max-width:991px){.navigation{display:none}} button{min-width:0} .fake-media{width:100%;min-height:130px;background:#def}
  </style><div class="shell"><nav class="navigation">Navigation</nav><div class="canvas"><header class="topbar">Header</header><div class="breadcrumbs">Compliance / Content screener</div><main>
  <div id="layout" class="${rootClass}">
    ${collapsed ? '<nav id="strip" class="hidden w-16 shrink-0 lg:flex">Queue</nav>' : ''}
    <section id="queue" aria-label="Review queue" class="relative ${queueClass} ${collapsed ? 'lg:hidden' : ''} lg:w-[var(--panel-w)] lg:max-w-[70vw]" style="--panel-w:560px">
      <div class="flex flex-col gap-2.5 p-4"><h1>Content screener</h1>
      <div role="tablist" aria-label="Queue" class="flex rounded-lg bg-muted p-0.5">${['To review 3','Sent back 0','Approved 0','Scheduled 1'].map(label => `<button role="tab" class="h-7 flex-1 whitespace-nowrap px-1 text-[11px]">${label}</button>`).join('')}</div>
      <div class="flex gap-2"><div class="relative min-w-0 flex-1"><input class="w-full" placeholder="Search posts"></div><button>Filters</button></div>
      </div><ul class="min-h-0 flex-1 overflow-y-auto"><li>Deskflex FB 1</li><li>Test post</li><li>TikTok video</li></ul>
    </section>
    <section id="post" aria-label="Post" class="min-w-0 flex-1 overflow-y-auto"><div class="mx-auto w-full p-5"><h2>Post preview</h2><div class="fake-media">Media</div><p>Caption and highlighted wording stay visible.</p></div></section>
    <aside id="review" aria-label="Your review" class="relative ${reviewClass} lg:w-[var(--panel-w)] lg:max-w-[70vw]" style="--panel-w:900px">
      <div class="flex min-h-0 flex-1 flex-col"><header class="shrink-0 p-4">Review sections<div class="grid grid-cols-2 gap-2"><button>Compliance 95/100</button><button>Sentiment review suggested</button><button>Comments</button></div></header>
      <div id="findings" class="min-h-0 flex-1 overflow-y-auto p-4">${'<p>Rule finding with context and supporting evidence.</p>'.repeat(25)}</div>
      <footer id="actions" class="shrink-0 border-t px-4 py-3"><div class="@container"><div class="grid grid-cols-1 gap-2 @[22rem]:grid-cols-2"><button class="h-10 text-[13px]">Request changes</button><button class="h-10 text-[13px]">Approve content</button><button class="h-10 text-[13px] @[22rem]:col-span-2">Send back &amp; allow publishing</button></div></div></footer></div>
    </aside>
  </div></main></div></div>
  <script>window.onload=()=>{const box=id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,right:r.right,bottom:r.bottom}};
  const data={viewport:{width:innerWidth,height:innerHeight},layout:box('layout'),post:box('post'),review:box('review'),queue:box('queue'),actions:box('actions'),overflow:document.documentElement.scrollWidth>innerWidth,
  buttons:[...document.querySelectorAll('#actions button')].map(b=>{const r=b.getBoundingClientRect();return {right:r.right,bottom:r.bottom}})};
  document.body.innerHTML='<pre id="result"></pre>';document.getElementById('result').textContent=JSON.stringify(data)};</script>`;
}

for (const [width, height, collapsed] of [[1024,768,false],[1280,800,false],[1366,768,false],[1366,768,true],[1536,864,false],[1920,1080,false],[390,844,false]]) {
  test(`screener fits ${width}x${height}, queue ${collapsed ? 'collapsed' : 'expanded'}, saved widths 560/900`, {skip:!browser}, () => {
    const folder = mkdtempSync(join(tmpdir(), 'screener-layout-test-'));
    try {
      writeFileSync(join(folder,'index.html'), fixture(collapsed));
      const result=spawnSync(browser,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--disable-background-networking',`--window-size=${width},${height}`,`--user-data-dir=${join(folder,'profile')}`,'--dump-dom',pathToFileURL(join(folder,'index.html')).href],{encoding:'utf8',windowsHide:true,timeout:30000});
      assert.equal(result.status,0,result.error?.message||result.stderr);
      const match=result.stdout.match(/<pre id="result">(.*?)<\/pre>/s);
      assert.ok(match,result.stdout);
      const metrics=JSON.parse(match[1].replaceAll('&quot;','"').replaceAll('&amp;','&'));
      assert.equal(metrics.overflow,false,JSON.stringify(metrics));
      assert.ok(metrics.post.width>150,JSON.stringify(metrics));
      assert.ok(metrics.review.right<=metrics.layout.right+1,JSON.stringify(metrics));
      assert.ok(metrics.buttons.every(button=>button.right<=metrics.review.right+1),JSON.stringify(metrics));
      if(metrics.viewport.width>=1024){
        assert.ok(metrics.actions.bottom<=metrics.viewport.height,JSON.stringify(metrics));
        assert.ok(metrics.post.right<=metrics.review.x+1,JSON.stringify(metrics));
      }
    } finally {
      assert.equal(resolve(dirname(folder)),resolve(tmpdir()));assert.ok(basename(folder).startsWith('screener-layout-test-'));
      try{rmSync(folder,{recursive:true,force:true,maxRetries:3})}catch{}
    }
  });
}

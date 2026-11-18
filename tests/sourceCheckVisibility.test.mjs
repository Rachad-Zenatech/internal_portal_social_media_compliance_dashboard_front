import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./loadTypeScriptService.mjs";

const visibility = loadService("sourceCheckVisibility", {}, "lib");
const { visibleSourceChecks } = visibility;
const { contextSourceFacts } = loadService("contextSourceFacts", { "@/lib/sourceCheckVisibility": visibility }, "lib");

function source(where, verdicts, status = "READ") {
  return { reference: "ZenaTech newsroom", where, kind: "URL", status,
    claims: verdicts.map((verdict, i) => ({ claim: `Claim ${i}`, verdict, where: "caption", confidence: 0.9 })) };
}

test("saved newsroom gaps disappear from review counts while supporting evidence remains", () => {
  const saved = source("newsroom", ["SUPPORTED", "NOT_FOUND", "UNCLEAR"]);
  const before = JSON.stringify(saved);
  const visible = visibleSourceChecks([saved]);
  assert.equal(visible.length, 1);
  assert.equal(visible[0].claims.length, 1);
  assert.equal(visible[0].claims[0].verdict, "SUPPORTED");
  assert.equal(JSON.stringify(saved), before);
});

test("a newsroom with only gaps or an unavailable check stays out of the source list", () => {
  assert.equal(visibleSourceChecks([source("newsroom", ["NOT_FOUND", "UNCLEAR"])]).length, 0);
  assert.equal(visibleSourceChecks([source("newsroom", [], "UNREADABLE")]).length, 0);
});

test("explicit newsroom contradictions retain evidence, date, and original article link", () => {
  const saved = source("newsroom", ["CONTRADICTED"]);
  saved.claims[0].evidence = "The article reports $8 million.";
  saved.claims[0].source_url = "https://www.zenatech.com/original-article/";
  saved.published = "2026-11-10";
  const [visible] = visibleSourceChecks([saved]);
  assert.equal(visible.claims[0], saved.claims[0]);
  assert.equal(visible.published, saved.published);
});

test("explicitly supplied newsroom pages retain every verdict and read failure", () => {
  for (const where of ["source_links", "caption", "script", "attached", "image"]) {
    const supplied = source(where, ["NOT_FOUND", "UNCLEAR", "CONTRADICTED"]);
    assert.equal(visibleSourceChecks([supplied])[0], supplied);
  }
  const unreadable = source("source_links", [], "UNREADABLE");
  assert.equal(visibleSourceChecks([unreadable])[0], unreadable);
});

test("creator Facts uses the same background-only newsroom policy", () => {
  assert.equal(contextSourceFacts([source("newsroom", ["NOT_FOUND", "UNCLEAR"])]).length, 0);
  assert.equal(contextSourceFacts([source("newsroom", ["SUPPORTED"])])[0].attention, false);
  assert.equal(contextSourceFacts([source("newsroom", ["CONTRADICTED"])])[0].attention, true);
  assert.equal(contextSourceFacts([source("source_links", ["NOT_FOUND"])])[0].attention, true);
});

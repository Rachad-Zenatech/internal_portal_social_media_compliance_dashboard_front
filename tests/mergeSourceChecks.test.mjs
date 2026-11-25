import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./loadTypeScriptService.mjs";

const loaded = loadService("mergeSourceChecks", {}, "lib", { URL });
const sourceIdentity = loaded.sourceIdentity;
const mergeSourceChecks = (...args) => JSON.parse(JSON.stringify(loaded.mergeSourceChecks(...args)));
const claim = (text, verdict = "SUPPORTED", where = "image") => ({ claim: text, verdict, where, confidence: 0.9 });
const source = (url, claims = [], where = "source_links") => ({
  kind: "URL", reference: url, url, title: "Army article", where, status: "READ", claims,
});

test("merges Army article aliases and preserves unique claims and discovery locations", () => {
  const result = mergeSourceChecks([
    source("https://www.army.mil/article/296517/article_title", [claim("One"), claim("Two")]),
    source("http://army.mil/article/296517/", [claim("One"), claim("Three")], "image"),
  ]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].claims.map((c) => c.claim), ["One", "Two", "Three"]);
  assert.deepEqual(result[0].origins, ["source_links", "image"]);
});

test("normalizes scheme, www, fragment, tracking, slash and parameter order", () => {
  assert.equal(sourceIdentity("http://www.example.com/page/?b=2&utm_source=post&a=1#heading"),
    sourceIdentity("https://example.com/page?a=1&b=2"));
});

test("does not collapse distinct articles, query IDs, path case or document names", () => {
  const urls = ["https://army.mil/article/1", "https://army.mil/article/2", "https://example.com/?id=1", "https://example.com/?id=2", "https://example.com/Page", "https://example.com/page"];
  assert.equal(mergeSourceChecks(urls.map((url) => source(url))).length, 6);
  assert.equal(mergeSourceChecks([ { ...source("a"), kind: "DOCUMENT" }, { ...source("b"), kind: "DOCUMENT" } ]).length, 2);
});

test("older saved quick checks do not reintroduce a duplicate or stale claim", () => {
  const url = "https://www.army.mil/article/1/title";
  const result = mergeSourceChecks([source(url, [claim("Current")])], {
    "http://army.mil/article/1/": source("http://army.mil/article/1/", [claim("Old", "NOT_FOUND")]),
  });
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].claims.map((c) => c.claim), ["Current"]);
});

test("prefers readable metadata without hiding conflicting verdicts or post locations", () => {
  const url = "https://example.com/article";
  const result = mergeSourceChecks([
    { ...source(url), status: "UNREADABLE", message: "Could not read" },
    { ...source(url, [claim("One"), claim("One", "CONTRADICTED"), claim("One", "SUPPORTED", "caption")]), message: null },
  ]);
  assert.equal(result[0].status, "READ");
  assert.equal(result[0].message, null);
  assert.equal(result[0].claims.length, 3);
});

test("deduplicates saved-only sources and handles missing results", () => {
  assert.deepEqual(mergeSourceChecks(), []);
  const result = mergeSourceChecks([], {
    first: source("https://example.com/article", [claim("One")]),
    second: source("http://www.example.com/article/", [claim("Two")]),
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].claims.length, 2);
});

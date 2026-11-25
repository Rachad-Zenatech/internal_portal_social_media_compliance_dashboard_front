import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./loadTypeScriptService.mjs";

const { visibleSourceChecks } = loadService("sourceCheckVisibility", {}, "lib");
const article = (status, claims = []) => ({ reference: "Rattler blood delivery", where: "newsroom", status, claims,
  message: "The full newsroom article could not be read. Its short summary was not used to verify claims." });

test("full-article read failures remain visible instead of disappearing from Sources checked", () => {
  const failure = article("UNREADABLE");
  const sources = visibleSourceChecks([failure]);
  assert.equal(sources.length, 1);
  assert.equal(sources[0], failure);
  assert.match(sources[0].message, /summary was not used/);
});

test("confirmed support from the full article stays visible", () => {
  const sources = visibleSourceChecks([article("READ", [{ claim: "ZenaDrone 1000 is under development", verdict: "SUPPORTED" }])]);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].claims[0].verdict, "SUPPORTED");
});

test("unrelated newsroom omissions still do not become extra source findings", () => {
  assert.equal(visibleSourceChecks([article("READ", [{ claim: "Blood transport temperature", verdict: "NOT_FOUND" }])]).length, 0);
});

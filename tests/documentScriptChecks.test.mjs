import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const apiUrl = moduleUrl(`
  export const documents = new Map();
  export const calls = [];
  export const scriptDocService = {
    get: async (id) => documents.get(id),
    check: async (id) => { calls.push(id); return { score: 90 }; },
  };
`);
const { documents, calls } = await import(apiUrl);
const background = await readFile(new URL("../src/services/backgroundScriptChecks.ts", import.meta.url), "utf8");
const trackUrl = moduleUrl(stripTypeScriptTypes(background.replace(/^import .*$/gm, "")));
const eligibilityUrl = new URL("../src/lib/scriptComplianceEligibility.ts", import.meta.url).href;
const service = await readFile(new URL("../src/services/documentScriptChecks.ts", import.meta.url), "utf8");
const compiled = stripTypeScriptTypes(service
  .replace('"@/services/backgroundScriptChecks"', JSON.stringify(trackUrl))
  .replace('"@/services/scriptDocService"', JSON.stringify(apiUrl))
  .replace('"@/lib/scriptComplianceEligibility"', JSON.stringify(eligibilityUrl)));
const { checkDocumentScript, runDocumentScriptCompliance } = await import(moduleUrl(compiled));

test("bulk skips unchanged results and checks changed and unchecked scripts", async () => {
  calls.length = 0;
  const original = { score: 42 };
  documents.set("unchanged", { latest_check: original, compliance_stale: false, sources_text: "" });
  documents.set("changed", { latest_check: original, compliance_stale: true, sources_text: "" });
  documents.set("new", { latest_check: null, sources_text: "" });
  const results = new Map();
  await runDocumentScriptCompliance("set", ["unchanged", "changed", "new"], (id, check) => results.set(id, check));
  assert.deepEqual(calls.sort(), ["changed", "new"]);
  assert.equal(results.get("unchanged"), original);
  assert.equal(results.size, 3);
});

test("overlapping single and bulk requests spend credits once per script", async () => {
  calls.length = 0;
  documents.set("overlap", { latest_check: null, sources_text: "" });
  await Promise.all([
    checkDocumentScript("overlap"),
    runDocumentScriptCompliance("other-set", ["overlap"], () => {}),
    checkDocumentScript("overlap"),
  ]);
  assert.deepEqual(calls, ["overlap"]);
});

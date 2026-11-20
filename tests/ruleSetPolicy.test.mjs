import assert from "node:assert/strict";
import test from "node:test";
import { requiredRuleSets, resolveRuleSets, ruleSetOptions } from "../src/lib/ruleSetPolicy.ts";

const PUBLIC = "Public Company Disclosure";
const GENERAL = "ZenaTech General";
const DEFENSE = "ZenaDrone Defense";
const CEO = "Shaun CEO Thought Leadership";
const all = [PUBLIC, GENERAL, DEFENSE, CEO];
const brands = { ZENATECH: GENERAL, SOFTWARE: GENERAL, DAAS: DEFENSE, ZENADRONE: DEFENSE, CEO_THOUGHT_LEADERSHIP: CEO };

for (const [brand, ownSet] of Object.entries(brands)) {
  for (const audience of ["GENERAL", "INVESTORS", "COMMERCIAL", "DEFENSE"]) {
    test(`${brand} / ${audience} uses only the required managed sets`, () => {
      const expected = new Set([PUBLIC, ownSet, ...(audience === "DEFENSE" ? [DEFENSE] : [])]);
      assert.deepEqual(new Set(requiredRuleSets([brand], [audience])), expected);
      assert.deepEqual(new Set(resolveRuleSets([brand], [audience], all)), expected);
    });
  }
}

test("changing brand and removing Defense drops stale sets", () => {
  const drone = resolveRuleSets(["DAAS"], ["GENERAL"]);
  const softwareDefense = resolveRuleSets(["SOFTWARE"], ["DEFENSE"], drone);
  assert.deepEqual(new Set(softwareDefense), new Set([PUBLIC, GENERAL, DEFENSE]));
  assert.deepEqual(resolveRuleSets(["SOFTWARE"], ["GENERAL"], softwareDefense), [PUBLIC, GENERAL]);
  assert.deepEqual(resolveRuleSets(["CEO_THOUGHT_LEADERSHIP"], ["GENERAL"], softwareDefense), [PUBLIC, CEO]);
});

test("required sets cannot be removed; additional ad rules are retained", () => {
  assert.deepEqual(resolveRuleSets(["DAAS"], [], []), [PUBLIC, DEFENSE]);
  assert.deepEqual(resolveRuleSets(["SOFTWARE"], [], [...all, "Paid Social Ads"]), [PUBLIC, GENERAL, "Paid Social Ads"]);
});

test("the picker excludes unrelated managed rule sets", () => {
  assert.deepEqual(ruleSetOptions([...all, "Paid Social Ads"], ["SOFTWARE"], []), [PUBLIC, GENERAL, "Paid Social Ads"]);
});

test("incomplete and new brand selections always retain disclosure", () => {
  assert.deepEqual(requiredRuleSets([], []), [PUBLIC]);
  assert.deepEqual(requiredRuleSets(["NEW_BRAND"], []), [PUBLIC]);
  assert.deepEqual(requiredRuleSets([], ["GENERAL", "DEFENSE"]), [PUBLIC, DEFENSE]);
});

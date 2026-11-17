import assert from "node:assert/strict";
import test from "node:test";
import { submissionRevisionSteps } from "../src/lib/submissionRevisionSteps.ts";

for (const scriptOnly of [false, true]) {
  for (const permission of [false, true]) {
    test(`${scriptOnly ? "script" : "finished post"}: ${permission ? "authorized to publish" : "needs review"}`, () => {
      const steps = submissionRevisionSteps(scriptOnly, permission);
      assert.equal(steps.at(-1).key, "send");
      assert.equal(steps.at(-1).label, permission ? "Publish" : "Reviewers");
      assert.equal(steps[0].key, "suggestions");
      assert.equal(steps.some((step) => step.key === "sentiment"), !scriptOnly);
      assert.equal(steps.filter((step) => step.key === "send").length, 1);
    });
  }
}

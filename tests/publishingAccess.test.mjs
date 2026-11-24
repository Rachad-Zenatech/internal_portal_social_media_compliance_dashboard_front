import { test } from "node:test";
import assert from "node:assert/strict";
import * as dates from "date-fns";
import { loadService } from "./loadTypeScriptService.mjs";

function calendar(check) {
  const values = new Map();
  const api = loadService("contentCalendar", {
    "@/services/publishingAccess": { requirePublishingAccess: check },
    react: { useSyncExternalStore: () => ({}) },
    "date-fns": dates,
  }, "lib", {
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    window: { dispatchEvent: () => true }, Event: class { constructor(name) { this.type = name; } },
  });
  return { api, values };
}

test("blocked suggestions window creates neither a schedule nor a publish record", async () => {
  const { api, values } = calendar(async () => { throw new Error("Suggestions are still open"); });
  await assert.rejects(api.recordSproutSend("sub-test", "2026-11-26T12:00:00Z"), /Suggestions are still open/);
  await assert.rejects(api.recordPublish("sub-test", "LINKEDIN", "DRAFT"), /Suggestions are still open/);
  assert.equal(values.size, 0);
});

test("a schedule is written only after the server grants access", async () => {
  let allow;
  const permission = new Promise(resolve => { allow = resolve; });
  const { api, values } = calendar(() => permission);
  const request = api.recordSproutSend("sub-test", "2026-11-26T12:00:00Z");
  assert.equal(values.size, 0);
  allow();
  const result = await request;
  assert.equal(result.scheduled_for, "2026-11-26T12:00:00Z");
  assert.equal(values.size, 1);
});

test("publication is also gated and records the approved platform once allowed", async () => {
  const calls = [];
  const { api } = calendar(async id => { calls.push(id); });
  const result = await api.recordPublish("sub-test", "LINKEDIN", "DRAFT");
  assert.equal(result.platform, "LINKEDIN");
  assert.equal(calls[0], "sub-test");
});

test("publishing access checks the actual post and fails closed on network errors", async () => {
  const calls = [];
  const denied = loadService("publishingAccess", {
    "@/services/submissionService": { submissionService: { publishingAccess: async id => { calls.push(id); return { can_publish: false, message: "Wait until deadline" }; } } },
  });
  await assert.rejects(denied.requirePublishingAccess("sub-real-post-id"), /Wait until deadline/);
  assert.equal(calls[0], "real-post-id");
  await denied.requirePublishingAccess("sample-1");
  assert.equal(calls.length, 1);
  const unavailable = loadService("publishingAccess", {
    "@/services/submissionService": { submissionService: { publishingAccess: async () => { throw new Error("Offline"); } } },
  });
  await assert.rejects(unavailable.requirePublishingAccess("sub-real-post-id"), /Offline/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./loadTypeScriptService.mjs";

function setup(put = async () => ({})) {
  let zone = "America/Toronto";
  const calls = [];
  const service = loadService("emailTimezoneService", {
    "@/services/apiClient": { apiClient: { put: (...args) => { calls.push(args); return put(...args); } } },
  }, "services", { Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: zone }) }) } });
  return { ...service, calls, setZone: (value) => { zone = value; } };
}

test("saves the detected IANA zone for the authenticated session without supplying a user ID", async () => {
  const service = setup();
  service.setZone("America/Los_Angeles");
  await service.syncEmailTimezone("reviewer");
  assert.equal(service.calls[0][0], "/api/notifications/email-timezone");
  assert.equal(service.calls[0][1].time_zone, "America/Los_Angeles");
  assert.equal(Object.keys(service.calls[0][1]).join(), "time_zone");
});

test("coalesces concurrent mounts and repeated focus events", async () => {
  let resolve;
  const service = setup(() => new Promise((done) => { resolve = done; }));
  const first = service.syncEmailTimezone("reviewer");
  const second = service.syncEmailTimezone("reviewer");
  assert.equal(service.calls.length, 1);
  resolve({});
  await Promise.all([first, second]);
  await service.syncEmailTimezone("reviewer");
  assert.equal(service.calls.length, 1);
});

test("travel and account switching update the saved zone", async () => {
  const service = setup();
  await service.syncEmailTimezone("reviewer");
  service.setZone("Europe/London");
  await service.syncEmailTimezone("reviewer");
  await service.syncEmailTimezone("another-reviewer");
  assert.equal(service.calls.length, 3);
  assert.equal(service.calls[1][1].time_zone, "Europe/London");
});

test("failed synchronization can retry on the next focus", async () => {
  let fails = true;
  const service = setup(async () => { if (fails) throw new Error("offline"); });
  await assert.rejects(service.syncEmailTimezone("reviewer"));
  fails = false;
  await service.syncEmailTimezone("reviewer");
  assert.equal(service.calls.length, 2);
});

test("missing browser zone is not replaced with an invented value", async () => {
  const service = setup();
  service.setZone(undefined);
  await service.syncEmailTimezone("reviewer");
  assert.equal(service.calls.length, 0);
});

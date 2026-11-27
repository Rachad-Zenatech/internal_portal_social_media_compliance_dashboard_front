import assert from "node:assert/strict";
import test from "node:test";
import * as dateFns from "date-fns";
import * as timezone from "@date-fns/tz";
import { loadService } from "./loadTypeScriptService.mjs";

const store = loadService("userTimezone", {}, "lib");
const dates = loadService("userDates", { "date-fns": dateFns, "@date-fns/tz": timezone, "./userTimezone": store }, "lib");
store.activateTimezoneUser("one");
const useZone = zone => store.applyTimezone("one", { time_zone: zone, source: "MANUAL" });
const utc = date => new Date(date.getTime()).toISOString();

test("zone option labels show seasonal abbreviations and UTC offsets", () => {
  const winter = new Date("2026-11-26T12:00:00Z");
  const summer = new Date("2026-07-01T12:00:00Z");
  assert.equal(store.timezoneOptionLabel("America/Toronto", winter), "America/Toronto — EST (UTC-05:00)");
  assert.equal(store.timezoneOptionLabel("America/Toronto", summer), "America/Toronto — EDT (UTC-04:00)");
  assert.equal(store.timezoneOptionLabel("America/Los_Angeles", winter), "America/Los Angeles — PST (UTC-08:00)");
  assert.equal(store.timezoneOptionLabel("America/Los_Angeles", summer), "America/Los Angeles — PDT (UTC-07:00)");
  assert.equal(store.timezoneOptionLabel("Asia/Manila", winter), "Asia/Manila — UTC+08:00");
  assert.equal(store.timezoneOptionLabel("UTC", winter), "UTC — UTC");
});

test("one stored instant displays and groups into the viewer's own day", () => {
  const instant = "2026-11-26T22:00:00Z";
  for (const [zone, expected] of [["America/Toronto", "2026-11-26 17:00"], ["Asia/Manila", "2026-11-27 06:00"], ["America/Los_Angeles", "2026-11-26 14:00"]]) {
    useZone(zone);
    assert.equal(dates.format(new Date(instant), "yyyy-MM-dd HH:mm"), expected);
    assert.equal(utc(dates.zonedDate(instant)), "2026-11-26T22:00:00.000Z");
    assert.equal(dates.format(dates.startOfDay(instant), "yyyy-MM-dd"), expected.slice(0, 10));
  }
});

test("Toronto wall-clock inputs account for summer and winter offsets", () => {
  useZone("America/Toronto");
  assert.equal(utc(dates.wallTimeDate("2026-07-01T17:00")), "2026-07-01T21:00:00.000Z");
  assert.equal(utc(dates.wallTimeDate("2026-12-01T17:00")), "2026-12-01T22:00:00.000Z");
  assert.equal(dates.wallTimeDate("2026-03-08T02:30").getTime().toString(), "NaN");
  assert.equal(utc(dates.wallTimeDate("2026-11-01T01:30")), "2026-11-01T05:30:00.000Z");
});

test("calendar days cross DST while elapsed countdowns keep the same instant", () => {
  useZone("America/Toronto");
  const before = dates.wallTimeDate("2026-03-07T12:00");
  const after = dates.addDays(before, 1);
  assert.equal((after.getTime() - before.getTime()) / 3600000, 23);
  assert.equal(dates.format(after, "HH:mm"), "12:00");
  useZone("Asia/Manila");
  assert.equal(after.getTime() - before.getTime(), 23 * 3600000);
});

test("switching users clears the old preference and rejects an old user's delayed response", () => {
  store.activateTimezoneUser("two");
  store.applyTimezone("two", { time_zone: "UTC", source: "MANUAL" });
  store.applyTimezone("one", { time_zone: "Asia/Manila", source: "MANUAL" });
  assert.equal(store.getUserTimezone(), "UTC");
});

test("an older detection response cannot replace a newly saved manual zone", async () => {
  store.activateTimezoneUser("race");
  let finishDetection;
  const api = { put: (_url, body) => body.source === "BROWSER"
    ? new Promise(resolve => { finishDetection = resolve; }) : Promise.resolve(body) };
  const service = loadService("emailTimezoneService", { "@/services/apiClient": { apiClient: api }, "@/lib/userTimezone": store });
  const pending = service.syncEmailTimezone("race");
  assert.equal(service.syncEmailTimezone("race"), pending);
  await service.saveUserTimezone("race", "Asia/Manila");
  finishDetection({ time_zone: "America/Toronto", source: "BROWSER" });
  await pending;
  assert.equal(store.getUserTimezone(), "Asia/Manila");
});

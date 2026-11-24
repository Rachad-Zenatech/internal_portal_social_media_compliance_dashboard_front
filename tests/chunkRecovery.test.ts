import { test } from "node:test";
import assert from "node:assert/strict";
import { recoverChunkLoad } from "../src/lib/chunkRecovery.ts";

function browser() {
  const data = new Map<string, string>();
  let reloads = 0;
  return {
    sessionStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
    },
    location: { reload: () => { reloads += 1; } },
    count: () => reloads,
  };
}

test("recovers the missing page module error from production", () => {
  const runtime = browser();
  assert.equal(recoverChunkLoad(new TypeError("Failed to fetch dynamically imported module: /assets/Users-old.js"), runtime, 100_000), true);
  assert.equal(runtime.count(), 1);
});

test("repeated preload and React errors only reload once within a minute", () => {
  const runtime = browser();
  assert.equal(recoverChunkLoad("Loading chunk Users failed", runtime, 100_000), true);
  assert.equal(recoverChunkLoad("Loading chunk Users failed", runtime, 100_001), false);
  assert.equal(runtime.count(), 1);
});

test("does not reload for API deletion errors or unrelated React errors", () => {
  const runtime = browser();
  for (const error of [new Error("Request failed: 500"), new Error("Cannot read properties of undefined"), null]) {
    assert.equal(recoverChunkLoad(error, runtime, 100_000), false);
  }
  assert.equal(runtime.count(), 0);
});

test("handles browser variants of module-loading errors", () => {
  for (const message of ["Importing a module script failed.", "error loading dynamically imported module: /assets/AppShell-old.js"]) {
    const runtime = browser();
    assert.equal(recoverChunkLoad({ message }, runtime, 100_000), true);
  }
});

test("storage restrictions do not cause errors or reload loops", () => {
  const runtime = browser();
  runtime.sessionStorage.setItem = () => { throw new Error("Storage blocked"); };
  assert.equal(recoverChunkLoad("Loading chunk Users failed", runtime, 100_000), false);
  assert.equal(runtime.count(), 0);
});

test("allows recovery on a later deployment after the cooldown", () => {
  const runtime = browser();
  recoverChunkLoad("Loading chunk Users failed", runtime, 100_000);
  assert.equal(recoverChunkLoad("Loading chunk Users failed", runtime, 161_000), true);
  assert.equal(runtime.count(), 2);
});

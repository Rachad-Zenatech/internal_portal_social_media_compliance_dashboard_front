import assert from "node:assert/strict";
import test from "node:test";
import { loadService } from "./loadTypeScriptService.mjs";

const { complianceSourcesChanged, sourceLinksKey } = loadService("complianceSources", {}, "lib");
const a = "https://example.com/a", b = "https://example.com/b";

test("new and removed sources invalidate saved inputs, including legacy checks", () => {
  assert.equal(complianceSourcesChanged({ source_checks: [] }, [a]), true);
  assert.equal(complianceSourcesChanged({ checked_source_links: [a] }, []), true);
  assert.equal(complianceSourcesChanged({ checked_source_links: [a] }, [a, b]), true);
  assert.equal(complianceSourcesChanged(null, [a]), false);
});

test("reordering, duplicates and fragments do not start another check", () => {
  assert.equal(sourceLinksKey([b, a, `${a}#section`]), sourceLinksKey([a, b]));
  assert.equal(complianceSourcesChanged({ source_checks: [{ where: "source_links", reference: a }] }, [a]), false);
});

test("source refresh waits for readiness and runs once per changed source set", () => {
  const refs = []; let index = 0, effects = [], calls = 0;
  const react = {
    useRef(value) { const slot = index++; refs[slot] ??= { current: value }; return refs[slot]; },
    useEffect(effect) { effects.push(effect); },
  };
  const { useSourceComplianceRefresh } = loadService("useSourceComplianceRefresh", { react }, "hooks");
  const onRefresh = async () => { calls++; };
  const render = (props) => {
    index = 0; effects = [];
    useSourceComplianceRefresh({ enabled: true, busy: false, revision: a, onRefresh, ...props });
    effects.forEach((effect) => effect());
  };
  render({ enabled: false }); assert.equal(calls, 0);
  render({ busy: true }); assert.equal(calls, 0);
  render({}); assert.equal(calls, 1);
  render({}); assert.equal(calls, 1);
  render({ busy: true }); render({}); assert.equal(calls, 1); // A cancelled run stays stopped.
  render({ revision: b }); assert.equal(calls, 2);
});

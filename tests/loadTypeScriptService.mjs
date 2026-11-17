import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Run the real TypeScript services with only network access replaced.
export function loadService(file, dependencies, folder = "services", globals = {}) {
  const source = readFileSync(new URL(`../src/${folder}/${file}.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  });
  const module = { exports: {} };
  runInNewContext(outputText, {
    ...globals,
    module, exports: module.exports,
    require(name) {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return module.exports;
}


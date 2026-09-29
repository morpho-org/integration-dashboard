import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
);

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(filePath);
    return [".ts", ".tsx", ".js", ".jsx"].some((extension) =>
      entry.name.endsWith(extension),
    ) && !entry.name.endsWith(".test.ts")
      ? [filePath]
      : [];
  });
}

test("uses morpho-sdk v6 without the V1 liquidity SDK", () => {
  assert.equal(
    packageJson.dependencies["@morpho-org/liquidity-sdk-viem"],
    undefined,
  );
  assert.ok(
    Number.parseInt(packageJson.dependencies["@morpho-org/morpho-sdk"], 10) >=
      6,
  );
});

test("application sources contain no Public Allocator V1 paths", () => {
  const forbidden = [
    "@morpho-org/liquidity-sdk-viem",
    "reallocateTo",
    "lib/augment",
    "anvil_setBalance",
    "REALLOCATION_SIMULATION_DELAY",
  ];
  const files = sourceFiles(path.join(root, "src"));
  const violations = [];

  for (const filePath of files) {
    const source = readFileSync(filePath, "utf8");
    for (const token of forbidden)
      if (source.includes(token))
        violations.push(`${path.relative(root, filePath)} contains ${token}`);
  }

  assert.deepEqual(violations, []);
});

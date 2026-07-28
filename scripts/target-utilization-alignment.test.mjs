import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8")
);
const constants = await readFile(
  new URL("../src/config/constants.ts", import.meta.url),
  "utf8"
);
const publicAllocator = await readFile(
  new URL("../src/core/publicAllocator.ts", import.meta.url),
  "utf8"
);
const verificationScript = await readFile(
  new URL("./verify-rate-at-target.ts", import.meta.url),
  "utf8"
);

test("canonical IRM target utilization remains 90%", () => {
  assert.match(constants, /TARGET_UTILIZATION = 900000000000000000n;/);
});

test("morpho-sdk is pinned to a release whose defaults are 90%", () => {
  const version = packageJson.dependencies["@morpho-org/morpho-sdk"];
  assert.ok(version, "expected an explicit @morpho-org/morpho-sdk dependency");

  const [major, minor] = version.replace(/^[^\d]*/, "").split(".").map(Number);
  assert.ok(
    major > 5 || (major === 5 && minor >= 4),
    `@morpho-org/morpho-sdk must be >= 5.4.0 for 90% defaults, got ${version}`
  );
});

test("public allocator targets come from the SDK, not a local constant", () => {
  assert.match(publicAllocator, /from "@morpho-org\/morpho-sdk\/constants";/);
  assert.match(
    publicAllocator,
    /DEFAULT_SUPPLY_TARGET_UTILIZATION =\s*\n?\s*SDK_DEFAULT_SUPPLY_TARGET_UTILIZATION;/
  );
  assert.match(
    publicAllocator,
    /DEFAULT_MAX_WITHDRAWAL_UTILIZATION =\s*\n?\s*SDK_DEFAULT_WITHDRAWAL_TARGET_UTILIZATION;/
  );
  assert.doesNotMatch(
    publicAllocator,
    /905000000000000000n|90_5000000000000000n|920000000000000000n|92_0000000000000000n/
  );
});

test("every reallocation call pins both the supply target and the withdrawal ceiling", () => {
  const supplyOverrides = publicAllocator.match(
    /defaultSupplyTargetUtilization: DEFAULT_SUPPLY_TARGET_UTILIZATION,/g
  );
  const withdrawalOverrides = publicAllocator.match(
    /defaultMaxWithdrawalUtilization: DEFAULT_MAX_WITHDRAWAL_UTILIZATION,/g
  );

  assert.ok(supplyOverrides, "expected explicit supply target overrides");
  assert.equal(
    withdrawalOverrides?.length,
    supplyOverrides.length,
    "every reallocation call must pin both the supply target and the withdrawal ceiling"
  );
});

test("rate verification uses the SDK supply target", () => {
  assert.match(
    verificationScript,
    /import \{ DEFAULT_SUPPLY_TARGET_UTILIZATION \} from "@morpho-org\/morpho-sdk\/constants";/
  );
  assert.doesNotMatch(
    verificationScript,
    /90\.5%|0\.905|905_000_000_000_000_000n|90_5000000000000000n/
  );
});

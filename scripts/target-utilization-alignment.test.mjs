import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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

test("canonical target utilization remains 90%", () => {
  assert.match(
    constants,
    /TARGET_UTILIZATION = 900000000000000000n;/
  );
});

test("public allocator default follows the canonical 90% IRM target", () => {
  assert.match(
    publicAllocator,
    /import \{ TARGET_UTILIZATION \} from \"\.\.\/config\/constants\";/
  );
  assert.match(
    publicAllocator,
    /DEFAULT_SUPPLY_TARGET_UTILIZATION = TARGET_UTILIZATION;/
  );
  assert.doesNotMatch(publicAllocator, /905000000000000000n|90\.5%/);
});

test("source withdrawal ceiling is pinned to the canonical target", () => {
  assert.match(
    publicAllocator,
    /DEFAULT_MAX_WITHDRAWAL_UTILIZATION = TARGET_UTILIZATION;/
  );

  const withdrawalOverrides = publicAllocator.match(
    /defaultMaxWithdrawalUtilization: DEFAULT_MAX_WITHDRAWAL_UTILIZATION,/g
  );
  const supplyOverrides = publicAllocator.match(
    /defaultSupplyTargetUtilization: DEFAULT_SUPPLY_TARGET_UTILIZATION,/g
  );

  assert.ok(supplyOverrides, "expected explicit supply target overrides");
  assert.equal(
    withdrawalOverrides?.length,
    supplyOverrides.length,
    "every populateBundle call must pin both the supply target and the withdrawal ceiling"
  );

  // Only the explanatory comment may mention the SDK's 92% fallback; no code path may set it.
  assert.doesNotMatch(publicAllocator, /920000000000000000n|92_0000000000000000n/);
});

test("rate verification uses the same canonical target", () => {
  assert.match(
    verificationScript,
    /import \{ TARGET_UTILIZATION \} from \"\.\.\/src\/config\/constants\";/
  );
  assert.match(
    verificationScript,
    /DEFAULT_SUPPLY_TARGET_UTILIZATION = TARGET_UTILIZATION;/
  );
  assert.doesNotMatch(verificationScript, /90\.5%|0\.905|905_000_000_000_000_000n/);
});

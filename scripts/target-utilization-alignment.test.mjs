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

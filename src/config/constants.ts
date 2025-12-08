import { CHAIN_CONFIGS } from "./chains";

// URLS
export const BLUE_API = "https://api.morpho.org/graphql";
export const WHITELIST_API =
  "https://blue-api.morpho.org/vault-lists/whitelist";
export const TARGET_API =
  "https://chl9tekt72.execute-api.us-east-1.amazonaws.com/dev/targets";
export const BLOCKING_FLOW_CAPS_API =
  "https://5glmns08q3.execute-api.us-east-1.amazonaws.com/dev/blockingFlowCaps";

// ADDRESSES - derived from chain config (single source of truth)
export const morphoAddress: Record<number, string> = Object.fromEntries(
  Object.values(CHAIN_CONFIGS).map((config) => [config.id, config.morphoAddress])
);

export const publicAllocatorAddress: Record<number, string> = Object.fromEntries(
  Object.values(CHAIN_CONFIGS).map((config) => [config.id, config.publicAllocatorAddress])
);

export const vaultBlacklist: Record<number, string[]> = {
  [CHAIN_CONFIGS.ethereum.id]: [
    "0x73e65DBD630f90604062f6E02fAb9138e713edD9", // Spark DAI
    "0xfbDEE8670b273E12b019210426E70091464b02Ab", // MEV Capital M^0 Vault
  ],
  [CHAIN_CONFIGS.base.id]: ["0xfbDEE8670b273E12b019210426E70091464b02Ab"],
};

// THRESHOLDS

export const USD_FLOWCAP_THRESHOLD = 50000;
export const REALLOCATION_THRESHOLD_PERCENT = 2; // 2%
export const REALLOCATION_DIST_THRESHOLD = 5; // 5%
export const REALLOCATION_USD_THRESHOLD = 10000;
export const BATCH_SIZE = 20;
// MATHS

export const WAD = 1000000000000000000n;
export const MaxUint128 = 340282366920938463463374607431768211455n;
export const MaxUint184 =
  3733918487410208413171452788281638525108659529247439357497450495n;
export const RAY = 1000000000000000000000000000n;
export const YEAR = 365n * 24n * 60n * 60n;

// MORPHO CONSTANTS

export const CURVE_STEEPNESS = 4n;
export const TARGET_UTILIZATION = 900000000000000000n;
export const VIRTUAL_ASSETS = 1n;
export const VIRTUAL_SHARES = 10n ** 6n;
export const ADJUSTMENT_SPEED = 50000000000000000000n / YEAR;
export const MIN_RATE_AT_TARGET = 1000000000000000n / YEAR;
export const MAX_RATE_AT_TARGET = 2000000000000000000n / YEAR;
export const LN_2_INT = 693147180559945309n;
export const LN_WEI_INT = -41446531673892822312n;
export const WEXP_UPPER_BOUND = 93859467695000404319n;
export const WEXP_UPPER_VALUE =
  57716089161558943949701069502944508345128422502756744429568n;

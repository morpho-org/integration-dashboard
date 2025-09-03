import { NETWORK_TO_CHAIN_ID } from "../types/networks";

// URLS
export const BLUE_API = "https://api.morpho.org/graphql";
export const WHITELIST_API =
  "https://blue-api.morpho.org/vault-lists/whitelist";
export const TARGET_API =
  "https://chl9tekt72.execute-api.us-east-1.amazonaws.com/dev/targets";
export const BLOCKING_FLOW_CAPS_API =
  "https://5glmns08q3.execute-api.us-east-1.amazonaws.com/dev/blockingFlowCaps";

// ADDRESSES

export const MORPHO = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";

export const publicAllocatorAddress: Record<number, string> = {
  [NETWORK_TO_CHAIN_ID.ethereum]: "0xfd32fA2ca22c76dD6E550706Ad913FC6CE91c75D",
  [NETWORK_TO_CHAIN_ID.base]: "0xA090dD1a701408Df1d4d0B85b716c87565f90467",
  [NETWORK_TO_CHAIN_ID.polygon]: "0xfac15aff53ADd2ff80C2962127C434E8615Df0d3",
  [NETWORK_TO_CHAIN_ID.unichain]: "0xB0c9a107fA17c779B3378210A7a593e88938C7C9",
  [NETWORK_TO_CHAIN_ID.arbitrum]: "0x769583Af5e9D03589F159EbEC31Cc2c23E8C355E",
  [NETWORK_TO_CHAIN_ID.katana]: "0x39EB6Da5e88194C82B13491Df2e8B3E213eD2412",
};

export const vaultBlacklist: Record<number, string[]> = {
  [NETWORK_TO_CHAIN_ID.ethereum]: [
    "0x73e65DBD630f90604062f6E02fAb9138e713edD9", // Spark DAI
    "0xfbDEE8670b273E12b019210426E70091464b02Ab", // MEV Capital M^0 Vault
  ],
  [NETWORK_TO_CHAIN_ID.base]: ["0xfbDEE8670b273E12b019210426E70091464b02Ab"],
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

/**
 * Supported networks in the Morpho integration dashboard
 */
export type SupportedNetwork = "ethereum" | "base" | "polygon" | "unichain" | "arbitrum" | "katana";

/**
 * Chain ID to network name mapping
 */
export const CHAIN_ID_TO_NETWORK: Record<number, SupportedNetwork> = {
  1: "ethereum",
  8453: "base", 
  137: "polygon",
  130: "unichain",
  42161: "arbitrum",
  747474: "katana",
} as const;

/**
 * Network name to chain ID mapping
 */
export const NETWORK_TO_CHAIN_ID: Record<SupportedNetwork, number> = {
  ethereum: 1,
  base: 8453,
  polygon: 137,
  unichain: 130,
  arbitrum: 42161,
  katana: 747474,
} as const;

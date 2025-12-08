import { Chain } from "viem";
import { arbitrum, base, mainnet, polygon, unichain } from "viem/chains";

/**
 * Supported network names
 */
export type SupportedNetwork =
  | "ethereum"
  | "base"
  | "polygon"
  | "unichain"
  | "arbitrum"
  | "katana"
  | "monad"
  | "stable";

/**
 * Chain configuration interface
 */
export interface ChainConfig {
  id: number;
  name: SupportedNetwork;
  displayName: string;
  viemChain: Chain;
  rpcEnvKey: string;
  dbBlockingFlowCapsKey: string;
  defiLlamaName: string;
  morphoAddress: string;
  publicAllocatorAddress: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrl?: string;
  blockExplorer: {
    name: string;
    url: string;
  };
  multicall3?: {
    address: `0x${string}`;
    blockCreated: number;
  };
}

// Custom chain definitions for chains not in viem
const katanaChain: Chain = {
  id: 747474,
  name: "Katana",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.katana.network/"],
    },
  },
  blockExplorers: {
    default: {
      name: "KatanaScan",
      url: "https://explorer.katanarpc.com/",
    },
  },
  contracts: {
    multicall3: {
      address: "0xca11bde05977b3631167028862be2a173976ca11",
      blockCreated: 1,
    },
  },
} as const;

const monadChain: Chain = {
  id: 143,
  name: "Monad",
  nativeCurrency: {
    name: "MON",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc-mainnet.monadinfra.com/rpc/jREsHNVkVpcEePcj7IuDA6TAB2hh1rlv"],
    },
  },
  blockExplorers: {
    default: {
      name: "MonadScan",
      url: "https://mainnet-beta.monvision.io/",
    },
  },
  contracts: {
    multicall3: {
      address: "0xca11bde05977b3631167028862be2a173976ca11",
      blockCreated: 1,
    },
  },
} as const;

const stableChain: Chain = {
  id: 988,
  name: "Stable",
  nativeCurrency: {
    name: "gUSDT",
    symbol: "gUSDT",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://partners-rpc.stable.xyz/helloworld.b581928d9caee63a688903d5e76c4b2d2d630cbd1cb6893d902a90190609775c"],
    },
  },
  blockExplorers: {
    default: {
      name: "StableScan",
      url: "https://stablescan.xyz",
    },
  },
  contracts: {
    multicall3: {
      address: "0xca11bde05977b3631167028862be2a173976ca11",
      blockCreated: 1,
    },
  },
} as const;

/**
 * Complete chain configurations - Single source of truth
 */
export const CHAIN_CONFIGS: Record<SupportedNetwork, ChainConfig> = {
  ethereum: {
    id: 1,
    name: "ethereum",
    displayName: "Ethereum",
    viemChain: mainnet,
    rpcEnvKey: "NEXT_PUBLIC_RPC_URL_MAINNET",
    dbBlockingFlowCapsKey: "mainnetBlockingFlowCaps",
    defiLlamaName: "ethereum",
    morphoAddress: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
    publicAllocatorAddress: "0xfd32fA2ca22c76dD6E550706Ad913FC6CE91c75D",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: { name: "Etherscan", url: "https://etherscan.io" },
  },
  base: {
    id: 8453,
    name: "base",
    displayName: "Base",
    viemChain: base,
    rpcEnvKey: "NEXT_PUBLIC_RPC_URL_BASE",
    dbBlockingFlowCapsKey: "baseBlockingFlowCaps",
    defiLlamaName: "base",
    morphoAddress: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
    publicAllocatorAddress: "0xA090dD1a701408Df1d4d0B85b716c87565f90467",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: { name: "BaseScan", url: "https://basescan.org" },
  },
  polygon: {
    id: 137,
    name: "polygon",
    displayName: "Polygon",
    viemChain: polygon,
    rpcEnvKey: "NEXT_PUBLIC_RPC_URL_POLYGON",
    dbBlockingFlowCapsKey: "polygonBlockingFlowCaps",
    defiLlamaName: "polygon",
    morphoAddress: "0x1bF0c2541F820E775182832f06c0B7Fc27A25f67",
    publicAllocatorAddress: "0xfac15aff53ADd2ff80C2962127C434E8615Df0d3",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    blockExplorer: { name: "PolygonScan", url: "https://polygonscan.com" },
  },
  unichain: {
    id: 130,
    name: "unichain",
    displayName: "Unichain",
    viemChain: unichain,
    rpcEnvKey: "NEXT_PUBLIC_RPC_URL_UNICHAIN",
    dbBlockingFlowCapsKey: "unichainBlockingFlowCaps",
    defiLlamaName: "unichain",
    morphoAddress: "0x8f5ae9CddB9f68de460C77730b018Ae7E04a140A",
    publicAllocatorAddress: "0xB0c9a107fA17c779B3378210A7a593e88938C7C9",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: { name: "UnichainScan", url: "https://unichain.blockscout.com" },
  },
  arbitrum: {
    id: 42161,
    name: "arbitrum",
    displayName: "Arbitrum",
    viemChain: arbitrum,
    rpcEnvKey: "NEXT_PUBLIC_RPC_URL_ARBITRUM",
    dbBlockingFlowCapsKey: "arbitrumBlockingFlowCaps",
    defiLlamaName: "arbitrum",
    morphoAddress: "0x6c247b1F6182318877311737BaC0844bAa518F5e",
    publicAllocatorAddress: "0x769583Af5e9D03589F159EbEC31Cc2c23E8C355E",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: { name: "Arbiscan", url: "https://arbiscan.io" },
  },
  katana: {
    id: 747474,
    name: "katana",
    displayName: "Katana",
    viemChain: katanaChain,
    rpcEnvKey: "NEXT_PUBLIC_RPC_URL_KATANA",
    dbBlockingFlowCapsKey: "katanaBlockingFlowCaps",
    defiLlamaName: "katana",
    morphoAddress: "0xD50F2DffFd62f94Ee4AEd9ca05C61d0753268aBc",
    publicAllocatorAddress: "0x39EB6Da5e88194C82B13491Df2e8B3E213eD2412",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: { name: "KatanaScan", url: "https://explorer.katanarpc.com/" },
    multicall3: { address: "0xca11bde05977b3631167028862be2a173976ca11", blockCreated: 1 },
  },
  monad: {
    id: 143,
    name: "monad",
    displayName: "Monad",
    viemChain: monadChain,
    rpcEnvKey: "NEXT_PUBLIC_RPC_URL_MONAD",
    dbBlockingFlowCapsKey: "monadBlockingFlowCaps",
    defiLlamaName: "monad",
    morphoAddress: "0xD5D960E8C380B724a48AC59E2DfF1b2CB4a1eAee",
    publicAllocatorAddress: "0xfd70575B732F9482F4197FE1075492e114E97302",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    blockExplorer: { name: "MonadScan", url: "https://mainnet-beta.monvision.io/" },
    multicall3: { address: "0xca11bde05977b3631167028862be2a173976ca11", blockCreated: 1 },
  },
  stable: {
    id: 988,
    name: "stable",
    displayName: "Stable",
    viemChain: stableChain,
    rpcEnvKey: "NEXT_PUBLIC_RPC_URL_STABLE",
    dbBlockingFlowCapsKey: "stableBlockingFlowCaps",
    defiLlamaName: "stable",
    morphoAddress: "0xa40103088A899514E3fe474cD3cc5bf811b1102e",
    publicAllocatorAddress: "0xbCB063D4B6D479b209C186e462828CBACaC82DbE",
    nativeCurrency: { name: "gUSDT", symbol: "gUSDT", decimals: 18 },
    blockExplorer: { name: "StableScan", url: "https://stablescan.xyz" },
    multicall3: { address: "0xca11bde05977b3631167028862be2a173976ca11", blockCreated: 1 },
  },
};

// Derived mappings for convenience
export const CHAIN_ID_TO_CONFIG: Record<number, ChainConfig> = Object.fromEntries(
  Object.values(CHAIN_CONFIGS).map((config) => [config.id, config])
);

export const NETWORK_TO_CHAIN_ID: Record<SupportedNetwork, number> = Object.fromEntries(
  Object.values(CHAIN_CONFIGS).map((config) => [config.name, config.id])
) as Record<SupportedNetwork, number>;

export const CHAIN_ID_TO_NETWORK: Record<number, SupportedNetwork> = Object.fromEntries(
  Object.values(CHAIN_CONFIGS).map((config) => [config.id, config.name])
);

export const SUPPORTED_CHAIN_IDS: number[] = Object.values(CHAIN_CONFIGS).map((c) => c.id);

// Helper functions
export function getChainConfig(chainId: number): ChainConfig | undefined {
  return CHAIN_ID_TO_CONFIG[chainId];
}

export function getChainConfigByName(name: SupportedNetwork): ChainConfig {
  return CHAIN_CONFIGS[name];
}

export function getViemChain(chainId: number): Chain {
  const config = CHAIN_ID_TO_CONFIG[chainId];
  if (!config) throw new Error(`Unsupported chain ID: ${chainId}`);
  return config.viemChain;
}

export function getNetworkId(network: string): number {
  const config = CHAIN_CONFIGS[network as SupportedNetwork];
  if (!config) throw new Error(`Invalid network: ${network}`);
  return config.id;
}

export function getNetworkName(networkId: number): SupportedNetwork {
  const name = CHAIN_ID_TO_NETWORK[networkId];
  if (!name) throw new Error(`Invalid chainId: ${networkId}`);
  return name;
}

export function getNetworkDBBlockingFlowCapsKey(network: string): string {
  const config = CHAIN_CONFIGS[network as SupportedNetwork];
  if (!config) throw new Error(`Invalid network: ${network}`);
  return config.dbBlockingFlowCapsKey;
}

export function getRpcEnvKey(chainId: number): string {
  const config = CHAIN_ID_TO_CONFIG[chainId];
  if (!config) throw new Error(`Unsupported chain ID: ${chainId}`);
  return config.rpcEnvKey;
}

export function getDefiLlamaChainName(chainId: number): string | undefined {
  return CHAIN_ID_TO_CONFIG[chainId]?.defiLlamaName;
}

// Chain mapping for viem (used in utils.ts chainMapping)
export const chainMapping: Record<number, Chain> = Object.fromEntries(
  Object.values(CHAIN_CONFIGS).map((config) => [config.id, config.viemChain])
);

// Export custom chains for backward compatibility
export { katanaChain as katana, monadChain as monad, stableChain as stable };

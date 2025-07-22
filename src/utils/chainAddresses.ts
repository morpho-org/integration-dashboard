import { getChainAddresses as getSDKChainAddresses } from "@morpho-org/blue-sdk";
import { type Address } from "viem";
import { publicAllocatorAddress, FACTORY_ADDRESSES_V1_1 } from "../config/constants";

// Define the structure that matches Blue SDK's ChainAddresses type
interface CustomChainAddresses {
  morpho: Address;
  adaptiveCurveIrm: Address;
  chainlinkOracleFactory?: Address;
  metaMorphoFactory: Address;
  publicAllocator: Address;
  preLiquidationFactory: Address;
  bundler?: Address;
  bundler3?: {
    bundler3: Address;
    generalAdapter1: Address;
  };
}

// Custom chain addresses for chains not supported by the Blue SDK
const CUSTOM_CHAIN_ADDRESSES: { [key: number]: CustomChainAddresses } = {
  // Add more custom chains here as needed
};

/**
 * Custom function to get chain addresses that includes our custom addresses
 * Falls back to Blue SDK for supported chains, uses custom addresses for unsupported chains
 */
export const getChainAddresses = (chainId: number): CustomChainAddresses | undefined => {
  try {
    // First try to get from Blue SDK
    const sdkAddresses = getSDKChainAddresses(chainId);
    if (sdkAddresses) {
      return sdkAddresses as CustomChainAddresses;
    }
    
    // If not found in SDK, check our custom addresses
    return CUSTOM_CHAIN_ADDRESSES[chainId];
  } catch {
    // If SDK throws, check our custom addresses
    return CUSTOM_CHAIN_ADDRESSES[chainId];
  }
};

/**
 * Check if a chain ID is supported (either by SDK or custom addresses)
 */
export const isChainSupported = (chainId: number): boolean => {
  return getChainAddresses(chainId) !== undefined;
};

/**
 * Get all supported chain IDs (both SDK and custom)
 */
export const getSupportedChainIds = (): number[] => {
  const customChainIds = Object.keys(CUSTOM_CHAIN_ADDRESSES).map(Number);
  
  // Note: We can't easily get all SDK-supported chains without trying each one,
  // so for now we return the known custom ones plus common SDK ones
  const knownSDKChains = [1, 8453, 137, 42161, 10]; // mainnet, base, polygon, arbitrum, optimism

  return [...new Set([...knownSDKChains, ...customChainIds])];
}; 
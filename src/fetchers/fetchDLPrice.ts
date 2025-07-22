import { getAddress } from "viem";
import { AssetPriceInfoDL, DefiLlamaResponse } from "../utils/types";
import { getCurrentTimestamp } from "../utils/utils";
// Define supported chains and their mappings
export const SUPPORTED_CHAINS: { [key: number]: string } = {
  1: "ethereum",
  10: "optimism",
  130: "unichain",
  137: "polygon",
  146: "sonic",
  252: "fraxtal",
  480: "wc", // World Chain
  8453: "base",
  34443: "mode",
  42161: "arbitrum",
  // 43111: "hemi", dl doesn't support it
  57073: "ink",
  534352: "scroll",
  21000000: "corn",
  747474: "katana",
};

/**
 * Fetches the current price of an asset from DefiLlama using multiple fallback strategies
 * @param address The asset's contract address
 * @param chainId The chain ID where the asset is deployed
 * @returns Asset price information or null if not found
 */
export async function fetchAssetPriceDL(
  address: string,
  chainId: number
): Promise<AssetPriceInfoDL | null> {
  const normalizedAddress = getAddress(address);
  
  // Strategy 1: Current chain
  const chainName = SUPPORTED_CHAINS[chainId];
  if (chainName) {
    console.log(`Trying to fetch price for ${chainName}:${normalizedAddress}`);
    const result = await tryFetchPrice(chainName, normalizedAddress);
    if (result) return result;
  }

  // Strategy 2: Try Ethereum mainnet as fallback (many tokens have prices there)
  if (chainId !== 1) {
    console.log(`Fallback: Trying Ethereum mainnet for ${normalizedAddress}`);
    const result = await tryFetchPrice("ethereum", normalizedAddress);
    if (result) return result;
  }

  // Strategy 3: Try other major chains as fallbacks
  const fallbackChains = ["base", "arbitrum", "optimism", "polygon"];
  for (const fallbackChain of fallbackChains) {
    if (fallbackChain !== chainName && fallbackChain !== "ethereum") {
      console.log(`Fallback: Trying ${fallbackChain} for ${normalizedAddress}`);
      const result = await tryFetchPrice(fallbackChain, normalizedAddress);
      if (result) return result;
    }
  }

  console.warn(`No price data found for ${normalizedAddress} on any supported chain`);
  return null;
}

/**
 * Helper function to try fetching price from a specific chain
 */
async function tryFetchPrice(
  chainName: string, 
  normalizedAddress: string
): Promise<AssetPriceInfoDL | null> {
  try {
    // Try with different search widths
    const searchWidths = ["4h", "12h", "24h"];
    
    for (const searchWidth of searchWidths) {
      const url = `https://coins.llama.fi/prices/current/${chainName}:${normalizedAddress}?searchWidth=${searchWidth}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        continue;
      }

      const data = (await response.json()) as DefiLlamaResponse;
      const coinKey = `${chainName}:${normalizedAddress}`;
      const coinData = data.coins[coinKey];

      if (!coinData) {
        continue;
      }

      // Allow slightly stale data (within last 48 hours) for better coverage
      const currentTimestamp = getCurrentTimestamp();
      if (currentTimestamp - coinData.timestamp > 48 * 60 * 60) {
        console.warn(`Price data for ${coinKey} is stale (${searchWidth} search)`);
        continue;
      }

      console.log(`Found price for ${coinKey} with ${searchWidth} search: $${coinData.price}`);
      return {
        decimals: coinData.decimals,
        symbol: coinData.symbol,
        price: coinData.price,
        timestamp: coinData.timestamp,
        confidence: coinData.confidence,
      };
    }
  } catch (error) {
    console.error(`Error fetching price from ${chainName}:`, error);
  }
  
  return null;
}

import { getAddress } from "viem";
import { getDefiLlamaChainName } from "../config/chains";
import { AssetPriceInfoDL, DefiLlamaResponse } from "../utils/types";
import { getCurrentTimestamp } from "../utils/utils";

/**
 * Fetches the current price of an asset from DefiLlama
 * @param address The asset's contract address
 * @param chainId The chain ID where the asset is deployed
 * @returns Asset price information or null if not found
 */
export async function fetchAssetPriceDL(
  address: string,
  chainId: number
): Promise<AssetPriceInfoDL | null> {
  try {
    // Get chain name from config
    const chainName = getDefiLlamaChainName(chainId);
    if (!chainName) {
      console.warn(`Unsupported chain ID: ${chainId}`);
      return null;
    }

    // Checksum address
    const normalizedAddress = getAddress(address);

    // Construct DefiLlama API URL
    const url = `https://coins.llama.fi/prices/current/${chainName}:${normalizedAddress}?searchWidth=4h`;

    // Fetch price data
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`HTTP error! status: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as DefiLlamaResponse;
    const coinKey = `${chainName}:${normalizedAddress}`;
    const coinData = data.coins[coinKey];

    if (!coinData) {
      console.warn(`No price data found for ${coinKey}`);
      return null;
    }

    // Verify timestamp is recent (within last 24 hours)
    const currentTimestamp = getCurrentTimestamp();
    if (currentTimestamp - coinData.timestamp > 24 * 60 * 60) {
      console.warn(`Price data for ${coinKey} is stale`);
      return null;
    }

    return {
      decimals: coinData.decimals,
      symbol: coinData.symbol,
      price: coinData.price,
      timestamp: coinData.timestamp,
      confidence: coinData.confidence,
    };
  } catch (error) {
    console.error("Error fetching price from DefiLlama:", error);
    return null;
  }
}

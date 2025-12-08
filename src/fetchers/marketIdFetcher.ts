import { getAddress, type Address } from "viem";
import { SUPPORTED_CHAIN_IDS } from "../config/chains";
import { morphoAddress } from "../config/constants";
import { initializeClient } from "../utils/client";

export interface MarketParams {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
}

interface MarketParamsResult {
  params: MarketParams | null;
  error: string | null;
  networkSuggestion: number | null;
}

export const fetchMarketParams = async (
  marketId: string,
  chainId: number
): Promise<MarketParamsResult> => {
  try {
    // Validate market ID format
    if (!marketId || !marketId.startsWith("0x") || marketId.length !== 66) {
      return {
        params: null,
        error: "Invalid market ID format. Must be a 0x-prefixed 32-byte hex string.",
        networkSuggestion: null,
      };
    }

    // Check if chain is supported
    const morpho = morphoAddress[chainId];
    if (!morpho) {
      // Try to find the market on supported networks
      const networkSuggestion = await findMarketOnSupportedNetworks(marketId);

      return {
        params: null,
        error: `Chain ID ${chainId} is not supported by Morpho Blue.`,
        networkSuggestion,
      };
    }

    // Get client for the selected chain
    const { client } = await initializeClient(chainId);

    // Call idToMarketParams function
    const result = await client.readContract({
      address: morpho as Address,
      abi: [
        {
          inputs: [{ internalType: "Id", name: "", type: "bytes32" }],
          name: "idToMarketParams",
          outputs: [
            { internalType: "address", name: "loanToken", type: "address" },
            { internalType: "address", name: "collateralToken", type: "address" },
            { internalType: "address", name: "oracle", type: "address" },
            { internalType: "address", name: "irm", type: "address" },
            { internalType: "uint256", name: "lltv", type: "uint256" },
          ],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "idToMarketParams",
      args: [marketId as `0x${string}`],
    });

    const [loanToken, collateralToken, oracle, irm, lltv] = result as [
      Address,
      Address,
      Address,
      Address,
      bigint
    ];

    // Check if the market exists (zero address means no market)
    const zeroAddress = "0x0000000000000000000000000000000000000000";
    if (
      loanToken === zeroAddress &&
      collateralToken === zeroAddress &&
      oracle === zeroAddress
    ) {
      // Try to find the market on other networks
      const networkSuggestion = await findMarketOnSupportedNetworks(marketId);
      return {
        params: null,
        error: "Market not found on the current network.",
        networkSuggestion,
      };
    }

    // Format and return market parameters
    return {
      params: {
        loanToken: getAddress(loanToken),
        collateralToken: getAddress(collateralToken),
        oracle: getAddress(oracle),
        irm: getAddress(irm),
        lltv,
      },
      error: null,
      networkSuggestion: null,
    };
  } catch (error) {
    console.error("Error fetching market params:", error);
    
    // Try to find the market on supported networks
    const networkSuggestion = await findMarketOnSupportedNetworks(marketId);
    
    return {
      params: null,
      error: "Error fetching market parameters. Please check your connection and try again.",
      networkSuggestion,
    };
  }
};

/**
 * Try to find the market on any of the supported networks
 */
async function findMarketOnSupportedNetworks(
  marketId: string
): Promise<number | null> {
  for (const networkId of SUPPORTED_CHAIN_IDS) {
    try {
      const morpho = morphoAddress[networkId];
      if (!morpho) continue;

      const { client } = await initializeClient(networkId);

      const result = await client.readContract({
        address: morpho as Address,
        abi: [
          {
            inputs: [{ internalType: "Id", name: "", type: "bytes32" }],
            name: "idToMarketParams",
            outputs: [
              { internalType: "address", name: "loanToken", type: "address" },
              { internalType: "address", name: "collateralToken", type: "address" },
              { internalType: "address", name: "oracle", type: "address" },
              { internalType: "address", name: "irm", type: "address" },
              { internalType: "uint256", name: "lltv", type: "uint256" },
            ],
            stateMutability: "view",
            type: "function",
          },
        ],
        functionName: "idToMarketParams",
        args: [marketId as `0x${string}`],
      });

      // Type the result properly
      const marketResult = result as [Address, Address, Address, Address, bigint];
      const [loanToken, collateralToken, oracle] = marketResult;

      const zeroAddress = "0x0000000000000000000000000000000000000000";
      if (
        loanToken !== zeroAddress &&
        collateralToken !== zeroAddress &&
        oracle !== zeroAddress
      ) {
        return networkId;
      }
    } catch (error) {
      console.error(`Error checking market ID on network ${networkId}:`, error);
    }
  }

  return null;
}

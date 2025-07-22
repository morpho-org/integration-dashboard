import { createPublicClient, http, type Address, getAddress, Chain } from "viem";
import { getChainAddresses } from "@morpho-org/blue-sdk";
import { chainMapping } from "../utils/utils";
import { initializeClient } from "../utils/client";

// List of chain IDs that are fully supported by the Blue SDK
const SUPPORTED_CHAIN_IDS = [1, 8453]; // Ethereum and Base

// Custom Morpho addresses for chains not supported by the Blue SDK
const CUSTOM_MORPHO_ADDRESSES: { [key: number]: Address } = {
  1135: "0x00cD58DEEbd7A2F1C55dAec715faF8aed5b27BF8", // Lisk
  1868: "0xE75Fc5eA6e74B824954349Ca351eb4e671ADA53a", // Soneium
  747474: "0xD50F2DffFd62f94Ee4AEd9ca05C61d0753268aBc", // Katana
  3637: "0x8183d41556Be257fc7aAa4A48396168C8eF2bEAD", // Botanix
  48900: "0xA902A365Fe10B4a94339B5A2Dc64F60c1486a5c8", // Zircuit
  239: "0x918B9F2E4B44E20c6423105BB6cCEB71473aD35c", // TAC
  999: "0x68e37dE8d93d3496ae143F2E900490f6280C57cD", // HyperEVM
};

// Custom function to get Morpho address that includes our custom addresses
const getMorphoAddress = (chainId: number): Address | undefined => {
  try {
    // First try to get from Blue SDK
    const sdkAddress = getChainAddresses(chainId)?.morpho;
    if (sdkAddress) return sdkAddress as Address;
    
    // If not found in SDK, check our custom addresses
    return CUSTOM_MORPHO_ADDRESSES[chainId];
  } catch {
    // If SDK throws, check our custom addresses
    return CUSTOM_MORPHO_ADDRESSES[chainId];
  }
};

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

    // Check if chain is supported in our client
    if (!Object.keys(chainMapping).includes(chainId.toString())) {
      return {
        params: null,
        error: `Chain ID ${chainId} is not supported by this tool.`,
        networkSuggestion: null,
      };
    }

    // Check if the chain is supported by Morpho Blue
    let morphoAddress;
    try {
      morphoAddress = getMorphoAddress(chainId);
      console.log("morphoAddress", morphoAddress);
    } catch (err) {
      console.error(`Error getting Morpho address for chain ${chainId}:`, err);
      
      // Try to find the market on supported networks
      const networkSuggestion = await findMarketOnSupportedNetworks(marketId);
      
      return {
        params: null,
        error: `Chain ID ${chainId} is not supported by Morpho Blue.`,
        networkSuggestion,
      };
    }

    if (!morphoAddress) {
      // Try to find the market on supported networks
      const networkSuggestion = await findMarketOnSupportedNetworks(marketId);
      
      return {
        params: null,
        error: "Morpho Blue not available on the selected network.",
        networkSuggestion,
      };
    }

    // Get client for the selected chain
    const { client } = await initializeClient(chainId);

    // Call idToMarketParams function
    const result = await client.readContract({
      address: morphoAddress as Address,
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
 * Try to find the market on any of the supported networks (both SDK and custom)
 */
async function findMarketOnSupportedNetworks(
  marketId: string
): Promise<number | null> {
  // Check both SDK supported chains and custom chains
  const allSupportedChains = [
    ...SUPPORTED_CHAIN_IDS,
    ...Object.keys(CUSTOM_MORPHO_ADDRESSES).map(Number)
  ];

  for (const networkId of allSupportedChains) {
    try {
      // Try to get the Morpho address using our custom function
      let morphoAddress;
      try {
        morphoAddress = getMorphoAddress(networkId);
        if (!morphoAddress) continue;
      } catch (err) {
        console.error(`Error getting Morpho address for chain ${networkId}:`, err);
        continue;
      }

      // Get the chain configuration from chainMapping
      // Use type assertion to handle the numeric key access
      const chainConfig = chainMapping[networkId as keyof typeof chainMapping];
      if (!chainConfig) continue;

      const client = createPublicClient({
        transport: http(),
        chain: chainConfig as Chain,
      });

      const result = await client.readContract({
        address: morphoAddress as Address,
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

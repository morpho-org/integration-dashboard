import { PublicClient } from "viem";
import {
    BLOCKING_FLOW_CAPS_API,
    BLUE_API,
    TARGET_API
} from "../config/constants";
import {
    Asset,
    BlockingFlowCaps,
    MarketWithWarning,
    MarketWithWarningAPIData,
    MetaMorphoAPIData,
    MetaMorphoVaultData,
    Strategy
} from "../utils/types";
import {
    formatMarketLink,
    formatMarketWithWarning,
    getMarketName
} from "../utils/utils";
import { getQueuesAndChecks } from "./chainFetcher";

export const fetchStrategies = async (
  networkId: number
): Promise<Strategy[]> => {
  try {
    const res = await fetch(`${TARGET_API}?chainId=${networkId}`);
    return await res.json();
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const fetchBlockingFlowCaps = async (
  networkId: number
): Promise<BlockingFlowCaps[]> => {
  try {
    const res = await fetch(`${BLOCKING_FLOW_CAPS_API}?chainId=${networkId}`);
    return await res.json();
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const fetchMorphoVaultsAddresses = async (networkId: number) => {
  // Define the GraphQL response type
  interface VaultQueryResponse {
    data: {
      vaults: {
        items: Array<{
          address: string;
          whitelisted: boolean;
        }>;
      };
    };
  }

  const PAGE_SIZE = 100;
  let allVaults: Array<{ address: string; whitelisted: boolean }> = [];
  let skip = 0;

  // Query with pagination
  const baseQuery = `
    query VaultData($skip: Int!) {
      vaults(
        first: ${PAGE_SIZE}
        skip: $skip
        where: {
          chainId_in: [${networkId}]
        }
      ) {
        items {
          address
          whitelisted
        }
      }
    }
  `;

  while (true) {
    try {
      const response = await fetch(BLUE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: baseQuery,
          variables: { skip },
        }),
      });

      const data = (await response.json()) as VaultQueryResponse;
      const newVaults = data.data.vaults.items;

      // If no new vaults returned, we've reached the end
      if (newVaults.length === 0) {
        break;
      }

      allVaults = [...allVaults, ...newVaults];

      // If we got less than PAGE_SIZE results, we've reached the end
      if (newVaults.length < PAGE_SIZE) {
        break;
      }

      skip += PAGE_SIZE;
    } catch (error) {
      console.error("Error fetching vaults:", error);
      break;
    }
  }

  return allVaults;
};

export const fetchVaultData = async (
  vaultAddress: string,
  networkId: number,
  client: PublicClient,
  isWhitelisted?: boolean
): Promise<MetaMorphoVaultData | undefined> => {
  // Define the GraphQL response type
  interface VaultQueryResponse {
    data: {
      vaults: {
        items: [
          {
            symbol: string;
            name: string;
            address: string;
            metadata: {
              curators: { name: string }[];
            };
            asset: Asset;
            allocators: { address: string }[];
            factory: { address: string };
            state: {
              timelock: number;
              owner: string;
              curator: string;
              totalAssets: number;
              totalAssetsUsd: number;
              allocation: {
                market: {
                  loanAsset: { symbol: string };
                  collateralAsset?: { symbol: string };
                  lltv: bigint;
                  uniqueKey: string;
                };
                supplyAssets: bigint;
                supplyCap: bigint;
              }[];
            };
          }
        ];
      };
    };
  }

  const query = `
  query VaulData {
  vaults(
    where: {
      address_in: "${vaultAddress}"
      chainId_in: [${networkId}]
    }
  ) {
    items {
      symbol
      name
      address
      metadata {
        curators {
          name
        }
      }
      asset {
        address
        priceUsd
        symbol
        decimals
      }
      allocators {
        address
      }
      factory {
        address
      }
      state {
        timelock
        owner
        curator
        totalAssets
        totalAssetsUsd
        allocation {
          market {
            loanAsset {
              symbol
            }
            collateralAsset {
              symbol
            }
            lltv
            uniqueKey
          }
          supplyAssets
          supplyCap
        }
      }
    }
  }
}
  `;

  // First, get the vault data from the API
  const response = await fetch(BLUE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { vault: vaultAddress } }),
  });

  const data = (await response.json()) as VaultQueryResponse;
  const vault = data.data.vaults.items[0];

  // Skip if vault not found
  if (!vault) {
    return undefined;
  }

  // Process curators and allocators with null checks
  const curators =
    vault.metadata?.curators?.map((curator) => curator.name) || [];
  const allocators =
    vault.allocators?.map((allocator) => allocator.address) || [];

  // Process enabled markets before using them
  const enabledMarkets = vault.state.allocation.map((current) => ({
    id: current.market.uniqueKey,
    name: getMarketName(
      current.market.loanAsset.symbol,
      current.market.collateralAsset?.symbol || null,
      current.market.lltv
    ),
    supplyAssets: current.supplyAssets,
    supplyCap: current.supplyCap,
    idle: !current.market.collateralAsset,
  }));

  // Now we can fetch queues and checks
  const { withdrawQueueOrder, supplyQueueOrder, flowCapsAndSafeResults } =
    await getQueuesAndChecks(
      vaultAddress,
      client,
      enabledMarkets,
      networkId,
      vault.state
    );

  // Process markets with the flow caps data
  const markets = enabledMarkets.map((market) => ({
    id: market.id,
    link: {
      name: market.name,
      url: formatMarketLink(market.id, networkId),
    },
    flowCaps: flowCapsAndSafeResults.flowCaps[market.id],
    supplyAssets: market.supplyAssets,
    supplyCap: market.supplyCap,
    idle: market.idle,
  }));

  const withdrawQueue = markets
    .sort((a, b) => {
      return (
        withdrawQueueOrder.indexOf(a.id) - withdrawQueueOrder.indexOf(b.id)
      );
    })
    .map((market) => {
      return {
        id: market.id,
        link: market.link,
        idle: market.idle,
      };
    });

  const supplyQueue = markets
    .filter((market) => supplyQueueOrder.includes(market.id))
    .sort((a, b) => {
      return supplyQueueOrder.indexOf(a.id) - supplyQueueOrder.indexOf(b.id);
    })
    .map((market) => {
      return {
        id: market.id,
        link: market.link,
        idle: market.idle,
      };
    });

  return {
    symbol: vault.symbol,
    address: vault.address,
    name: vault.name,
    asset: vault.asset,
    totalAssets: vault.state.totalAssets,
    totalAssetsUsd: vault.state.totalAssetsUsd,
    curators,
    allocators,
    factoryAddress: vault.factory.address,
    timelock: vault.state.timelock,
    owner: vault.state.owner,
    ownerSafeDetails: flowCapsAndSafeResults.safeResults[vault.state.owner],
    curator: vault.state.curator,
    curatorSafeDetails: vault.state.curator
      ? flowCapsAndSafeResults.safeResults[vault.state.curator]
      : { isSafe: false },
    withdrawQueue,
    supplyQueue,
    markets,
    isWhitelisted: isWhitelisted || false,
  };
};

export const fetchMarketAssets = async (
  marketId: string,
  chainId: number
): Promise<{ loanAsset: Asset; collateralAsset: Asset }> => {
  const query = `
    query {
    markets(where: {  uniqueKey_in: "${marketId}", chainId_in: [${chainId}]} ) {
      items {
        collateralAsset {
          address
          symbol
          decimals
          priceUsd
        }
        loanAsset {
          address
          symbol
          decimals
          priceUsd
        }
      }
    }
  }
    `;

  const response = await fetch(BLUE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const data = await response.json();
  const market = data.data.markets.items[0];

  return {
    loanAsset: market.loanAsset,
    collateralAsset: market.collateralAsset,
  };
};

export const fetchPublicAllocator = async (
  networkId: number
): Promise<{ publicAllocator: string }> => {
  const query = `
    query {
  publicAllocators(where:{chainId_in:[${networkId}]}) {
    items {
      address
      creationBlockNumber
      morphoBlue {
        address
        chain {
          id
          network
        }
      }
    }
  }
}
    `;

  const response = await fetch(BLUE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const data = await response.json();
  const publicAllocator = data.data.publicAllocators.items[0];

  return {
    publicAllocator: publicAllocator.address,
  };
};

export const fetchSupplingVaultsData = async (
  marketId: string
): Promise<MetaMorphoAPIData[]> => {
  const query = `
    query {
      markets(where: { uniqueKey_in: ["${marketId}"]} ) {
        items {
          supplyingVaults {
            symbol
          name
          address
          asset {
            address
            priceUsd
            symbol
            decimals
          }
          state {
            totalAssets
            apy
            netApy
            fee
            allocation {
              market {
                uniqueKey
              }
              supplyAssets
              supplyCap
            }
          }
        }
      }
    }
  }`;

  const response = await fetch(BLUE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const data = await response.json();

  console.log(
    `${data.data.markets.items[0].supplyingVaults.length} supplying vaults`
  );

  return data.data.markets.items[0].supplyingVaults;
};

export const fetchAssetData = async (assetAddress: string): Promise<Asset> => {
  const query = `
    query{
      assets (where: {address_in: "${assetAddress}"}) {
        items {
          address
          symbol
          priceUsd
          decimals
        }
      }
    }`;

  const response = await fetch(BLUE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const data = await response.json();
  return data.data.assets.items[0];
};

export const fetchMarketsWithWarnings = async (
  networkId: number
): Promise<MarketWithWarning[]> => {
  const query = `
    query {
    markets(where: { whitelisted: true, chainId_in: ${networkId}} ) {
      items {
        uniqueKey
        collateralAsset {
          symbol
        }
        loanAsset {
          symbol
        }
        lltv
        warnings {
          type
          level
        }
        state {
          supplyAssetsUsd
          borrowAssetsUsd
          collateralAssetsUsd
      }
      }
    }
  }`;

  const response = await fetch(BLUE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const data = await response.json();
  const whitelistedMarkets: MarketWithWarningAPIData[] =
    data.data.markets.items;

  const marketsWithWarnings = whitelistedMarkets.filter(
    (market: MarketWithWarningAPIData) => market.warnings.length > 0
  );

  const marketWithRedWarnings = marketsWithWarnings
    .filter((market) =>
      market.warnings!.some((warning) => warning.level === "RED")
    )
    .map((market) => formatMarketWithWarning(market, networkId));

  const marketWithoutRedWarnings = marketsWithWarnings
    .filter(
      (market) => !market.warnings!.some((warning) => warning.level === "RED")
    )
    .map((market) => formatMarketWithWarning(market, networkId));

  return [...marketWithRedWarnings, ...marketWithoutRedWarnings];
};

export const fetchMarketWithoutStrategyData = async (
  id: string
): Promise<MarketWithWarningAPIData> => {
  const query = `
    query {
    markets(where: {  uniqueKey_in: "${id}"} ) {
      items {
        uniqueKey
        collateralAsset {
          symbol
        }
        loanAsset {
          symbol
        }
        lltv
      }
    }
  }`;

  const response = await fetch(BLUE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const data = await response.json();
  return data.data.markets.items[0];
};

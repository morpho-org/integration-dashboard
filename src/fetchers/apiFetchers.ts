import { Provider } from "ethers";
import {
  BLOCKING_FLOW_CAPS_API,
  BLUE_API,
  TARGET_API,
  WHITELIST_API,
} from "../config/constants";
import {
  Asset,
  BlockingFlowCaps,
  MarketWithWarning,
  MarketWithWarningAPIData,
  MetaMorphoAPIData,
  MetaMorphoVaultData,
  Strategy,
  WhitelistedVault,
} from "../utils/types";
import {
  formatMarketLink,
  formatMarketWithWarning,
  getMarketName,
} from "../utils/utils";
import { checkIfSafe, fetchFlowCaps, getQueues } from "./chainFetcher";

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

export const fetchWhitelistedMetaMorphos = async (
  chainId: number
): Promise<WhitelistedVault[]> => {
  try {
    const res = await fetch(WHITELIST_API);
    const data = await res.json();
    const metaMorphos: WhitelistedVault[] = data.filter(
      (vault: { address: string; chainId: string }) =>
        Number(vault.chainId) === chainId
    );
    return metaMorphos;
  } catch (error) {
    throw error;
  }
};

export const fetchVaultData = async (
  vaultAddress: string,
  networkId: number,
  strategies: Strategy[],
  provider: Provider
): Promise<MetaMorphoVaultData> => {
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
      state {
        owner
        curator
        totalAssets
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

  const [response, { withdrawQueueOrder, supplyQueueOrder }] =
    await Promise.all([
      fetch(BLUE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { vault: vaultAddress } }),
      }),
      getQueues(vaultAddress, provider),
    ]);
  const data = await response.json();
  const vault = data.data.vaults.items[0];

  const curators: string[] = vault.metadata.curators.map(
    (curator: { name: string }) => {
      return curator.name;
    }
  );

  const enabledMarkets = vault.state.allocation.reduce(
    (acc: any, current: any) => {
      acc.push({
        id: current.market.uniqueKey,
        name: getMarketName(
          current.market.loanAsset.symbol,
          current.market.collateralAsset
            ? current.market.collateralAsset.symbol
            : null,
          current.market.lltv
        ),
        supplyAssets: current.supplyAssets,
        supplyCap: current.supplyCap,
        idle: !current.market.collateralAsset,
      });
      return acc;
    },
    []
  );

  const markets = await Promise.all(
    enabledMarkets.map(
      async (market: {
        id: string;
        name: string;
        supplyAssets: bigint;
        supplyCap: bigint;
        idle: boolean;
      }) => {
        return {
          id: market.id,
          link: {
            name: market.name,
            url: formatMarketLink(market.id, networkId),
          },
          flowCaps: await fetchFlowCaps(
            vault.address,
            market.id,
            networkId,
            provider
          ),
          supplyAssets: market.supplyAssets,
          supplyCap: market.supplyCap,
          idle: market.idle,
        };
      }
    )
  );

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

  const [ownerSafeDetails, curatorSafeDetails] = await Promise.all([
    checkIfSafe(provider, vault.state.owner),
    vault.state.curator
      ? checkIfSafe(provider, vault.state.curator)
      : Promise.resolve({ isSafe: false }),
  ]);

  return {
    symbol: vault.symbol,
    address: vault.address,
    name: vault.name,
    asset: vault.asset,
    totalAssets: vault.state.totalAssets,
    curators,
    owner: vault.state.owner,
    ownerSafeDetails,
    curator: vault.state.curator,
    curatorSafeDetails,
    withdrawQueue,
    supplyQueue,
    markets,
  };
};

export const fetchMarketAssets = async (
  marketId: string
): Promise<{ loanAsset: Asset; collateralAsset: Asset }> => {
  const query = `
    query {
    markets(where: {  uniqueKey_in: "${marketId}"} ) {
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

  console.log("markets with warnings");

  const marketWithRedWarnings = marketsWithWarnings
    .filter((market) =>
      market.warnings!.some((warning) => warning.level === "RED")
    )
    .map((market) => formatMarketWithWarning(market, networkId));

  console.log("markets with red warnings");

  const marketWithoutRedWarnings = marketsWithWarnings
    .filter(
      (market) => !market.warnings!.some((warning) => warning.level === "RED")
    )
    .map((market) => formatMarketWithWarning(market, networkId));

  console.log("markets returned");

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

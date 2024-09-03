import { id, Provider } from "ethers";
import { BLUE_API, TARGET_API, WHITELIST_API } from "../config/constants";
import {
  Asset,
  MetaMorphoAPIData,
  MetaMorphoVaultFlowCaps,
  Strategy,
  WhitelistedVault,
} from "../utils/types";
import { formatMarketLink, getMarketName } from "../utils/utils";
import { fetchFlowCaps, getQueues } from "./chainFetcher";

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

export const fetchVaultFlowCapsData = async (
  vaultAddress: string,
  networkId: number,
  strategies: Strategy[],
  provider: Provider
): Promise<MetaMorphoVaultFlowCaps> => {
  const query = `
  query VaulData{
    vaults(where: {address_in: "${vaultAddress}"}) {
      items
      {
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
          allocation {
            market {
              loanAsset {symbol}
              collateralAsset {symbol}
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
      }) => {
        const strategy = strategies.find(
          (strategy) => strategy.id === market.id
        );
        return {
          id: market.id,
          name: market.name,
          link: formatMarketLink(market.id, networkId),
          flowCaps: await fetchFlowCaps(
            vault.address,
            market.id,
            networkId,
            provider
          ),
          supplyAssets: market.supplyAssets,
          supplyCap: market.supplyCap,
          idle: strategy?.idleMarket,
        };
      }
    )
  );

  const withdrawQueue = markets
    .map((market) => {
      return {
        id: market.id,
        link: market.link,
        name: market.name,
        idle: market.idle,
      };
    })
    .sort((a, b) => {
      return (
        withdrawQueueOrder.indexOf(a.id) - withdrawQueueOrder.indexOf(b.id)
      );
    });

  const supplyQueue = markets
    .filter((market) => supplyQueueOrder.includes(market.id))
    .map((market) => {
      return {
        id: market.id,
        link: market.link,
        name: market.name,
        idle: market.idle,
      };
    })
    .sort((a, b) => {
      return supplyQueueOrder.indexOf(a.id) - supplyQueueOrder.indexOf(b.id);
    });

  return {
    symbol: vault.symbol,
    address: vault.address,
    name: vault.name,
    asset: vault.asset,
    totalAssets: vault.state.totalAssets,
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

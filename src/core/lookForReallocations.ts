import { formatVaultLink, sortVaultReallocationData } from "./../utils/utils";
import { PublicClient } from "viem";
import {
  MetaMorphoAPIData,
  MetaMorphoPosition,
  MetaMorphoVault,
  OutOfBoundsMarket,
  Strategy,
  VaultReallocationData,
} from "../utils/types";
import {
  fetchStrategies,
  fetchSupplingVaultsData,
} from "../fetchers/apiFetchers";
import {
  fetchVaultMarketPositionAndCap,
  getFlowCaps,
  getVaultMarketData,
} from "../fetchers/chainFetcher";
import {
  getMarketReallocationData,
  seekForSupplyReallocation,
  seekForWithdrawReallocation,
} from "../utils/reallocationMaths";
import { initializeClient } from "../utils/client";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second delay between retries
const BATCH_SIZE = 5;
const BATCH_DELAY = 2000; // 2 second delay between batches

const initializeSupplyingVaultWithRetry = async (
  vaultData: MetaMorphoAPIData,
  reallocationMarketId: string,
  strategies: Strategy[],
  client: PublicClient,
  networkId: number
): Promise<MetaMorphoVault | undefined> => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await initializeSupplyingVault(
        vaultData,
        reallocationMarketId,
        strategies,
        client,
        networkId
      );
    } catch (error) {
      if (attempt === MAX_RETRIES) throw error;
      console.warn(
        `Failed to initialize vault ${vaultData.address}, attempt ${attempt}/${MAX_RETRIES}. Retrying...`
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    }
  }
};

export const lookForReallocations = async (
  networkId: number,
  outOfBoundsMarket: OutOfBoundsMarket,
  filterIdleMarkets: boolean
) => {
  const [{ client: clientMainnet }, { client: clientBase }] = await Promise.all(
    [initializeClient(1), initializeClient(8453)]
  );

  let client: PublicClient;
  if (networkId === 1) {
    client = clientMainnet;
  } else if (networkId === 8453) {
    client = clientBase;
  }

  const [supplyingVaultsApiData, strategies] = await Promise.all([
    fetchSupplingVaultsData(outOfBoundsMarket.id),
    fetchStrategies(networkId),
  ]);

  // Process vaults in batches with retry mechanism and delay between batches
  const supplyingVaults = [];
  for (let i = 0; i < supplyingVaultsApiData.length; i += BATCH_SIZE) {
    console.log("fetching vault batch", i);
    const batch = supplyingVaultsApiData.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch
        .slice(0, 1)
        .map((vault) =>
          initializeSupplyingVaultWithRetry(
            vault,
            outOfBoundsMarket.id,
            strategies,
            client,
            networkId
          )
        )
    );
    supplyingVaults.push(
      ...batchResults.filter((result) => result !== undefined)
    );

    // Add delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < supplyingVaultsApiData.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
    }
  }

  console.log("supplying vaults initialized");

  const vaultReallocationData: VaultReallocationData[] = supplyingVaults.map(
    (vault) => {
      return {
        supplyReallocation: outOfBoundsMarket.aboveRange,
        vault,
        marketReallocationData: getMarketReallocationData(
          vault,
          outOfBoundsMarket.amountToReachTarget,
          outOfBoundsMarket.aboveRange,
          networkId
        ),
        reallocation: outOfBoundsMarket.aboveRange
          ? seekForSupplyReallocation(
              outOfBoundsMarket.id,
              vault,
              filterIdleMarkets
            )
          : seekForWithdrawReallocation(
              outOfBoundsMarket.id,
              vault,
              filterIdleMarkets
            ),
      };
    }
  );

  return sortVaultReallocationData(vaultReallocationData);
};

const initializeSupplyingVault = async (
  vaultData: MetaMorphoAPIData,
  reallocationMarketId: string,
  strategies: Strategy[],
  client: PublicClient,
  networkId: number
): Promise<MetaMorphoVault> => {
  const underlyingAsset = vaultData.asset;
  const supplyPositions = vaultData.state.allocation
    .filter((allocation) => {
      const strategy = strategies.find(
        (strategy) => strategy.id === allocation.market.uniqueKey
      );
      return strategy && !strategy.blacklist;
    })
    .reduce((acc: any, current: any) => {
      acc[current.market.uniqueKey] = {
        supplyCap: BigInt(current.supplyCap),
        supplyAssets: BigInt(current.supplyAssets),
      };
      return acc;
    }, {});

  supplyPositions[reallocationMarketId] = await fetchVaultMarketPositionAndCap(
    client,
    reallocationMarketId,
    vaultData.address
  );

  // Get all market IDs including the reallocation market
  const marketIds = Object.keys(supplyPositions);

  // Fetch market data and flow caps in parallel
  const [marketData, flowCaps] = await Promise.all([
    Promise.all(
      marketIds.map((marketId) =>
        getVaultMarketData(marketId, underlyingAsset, strategies, client)
      )
    ),
    getFlowCaps(vaultData.address, marketIds, networkId, client),
  ]);

  // Build positions object
  const positions: { [key: string]: MetaMorphoPosition } = {};
  for (let i = 0; i < marketIds.length; i++) {
    positions[marketIds[i]] = {
      marketData: marketData[i],
      supplyAssets: supplyPositions[marketIds[i]].supplyAssets,
      supplyCap: supplyPositions[marketIds[i]].supplyCap,
    };
  }

  const totalAssetsUsd =
    (underlyingAsset.priceUsd * vaultData.state.totalAssets) /
    10 ** Number(underlyingAsset.decimals);

  return {
    address: vaultData.address,
    link: {
      url: formatVaultLink(vaultData.address, networkId),
      name: vaultData.address,
    },
    underlyingAsset,
    totalAssetsUsd,
    positions,
    flowCaps,
  };
};

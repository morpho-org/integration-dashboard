import { formatUnits, withRetry } from "viem";
import {
  MarketFlowCaps,
  MetaMorphoVaultData,
  VaultData,
  VaultWarnings,
} from "../utils/types";
import {
  FACTORY_ADDRESSES_V1_1,
  MaxUint128,
  MaxUint184,
  USD_FLOWCAP_THRESHOLD,
} from "../config/constants";
import {
  formatTokenAmount,
  formatUsdAmount,
  formatVaultLink,
} from "../utils/utils";
import {
  fetchPublicAllocator,
  fetchVaultData,
  fetchMorphoVaultsAddresses,
} from "../fetchers/apiFetchers";
import { initializeClient } from "../utils/client";
import { PublicClient } from "viem/_types/clients/createPublicClient";

export const getVaultDisplayData = async (
  networkId: number,
  isWhitelistedOnly: boolean = true
): Promise<VaultData[]> => {
  // Fetch data in parallel
  const [allVaults, publicAllocator] = await Promise.all([
    fetchMorphoVaultsAddresses(networkId),
    fetchPublicAllocator(networkId),
  ]);

  // Filter vaults based on whitelist status before processing
  const vaultsToProcess = isWhitelistedOnly
    ? allVaults.filter((vault) => vault.whitelisted)
    : allVaults
        // .filter(
        //   (vault) =>
        //     vault.address.toLowerCase() ===
        //     "0x2a79E2c69ff4d3a50BF335153e4c09Fa360F3386".toLowerCase()
        // )
        .filter((vault) => !vault.whitelisted);

  // Initialize clients in parallel
  const [{ client: clientMainnet }, { client: clientBase }, { client: clientPolygon }, { client: clientUnichain }] = await Promise.all(
    [initializeClient(1), initializeClient(8453), initializeClient(137), initializeClient(130)]
  );

  let client: PublicClient;
  if (networkId === 1) {
    client = clientMainnet;
  } else if (networkId === 8453) {
    client = clientBase;
  } else if (networkId === 137) {
    client = clientPolygon;
  } else if (networkId === 130) {
    client = clientUnichain;
  }

  // Fetch vault data in batches
  const BATCH_SIZE = 10;
  const vaultData = [];

  for (let i = 0; i < vaultsToProcess.length; i += BATCH_SIZE) {
    const batch = vaultsToProcess.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((vault) =>
        withRetry(() =>
          fetchVaultData(vault.address, networkId, client, vault.whitelisted)
        )
      )
    );
    const validResults = batchResults.filter(
      (result): result is MetaMorphoVaultData => result !== undefined
    );
    vaultData.push(...validResults);
  }

  console.log("finalized querying vault data");

  // Process vault data
  const processedVaults = vaultData
    .filter((vault): vault is NonNullable<typeof vault> => {
      if (!vault) {
        console.warn("Skipping undefined vault");
        return false;
      }

      // Add basic validation for required properties
      if (!vault.address || !vault.factoryAddress || !vault.timelock) {
        console.warn("Skipping malformed vault data:", vault);
        return false;
      }

      return true;
    })
    .map((vault) => {
      try {
        const markets = processMarkets(vault);
        const warnings = generateWarnings(markets, vault);

        // Use optional chaining and provide defaults
        return {
          isV1_1: vault.factoryAddress
            ? isV1_1Factory(vault.factoryAddress, networkId)
            : false,
          timelock: vault.timelock,
          vault: formatVaultInfo(vault, networkId),
          markets: sortMarkets(markets),
          warnings,
          curators: vault.curators ?? [],
          supplyQueue: vault.supplyQueue ?? [],
          withdrawQueue: vault.withdrawQueue ?? [],
          owner: vault.owner ?? "0x0000000000000000000000000000000000000000",
          ownerSafeDetails: vault.ownerSafeDetails ?? { isSafe: false },
          curator:
            vault.curator ?? "0x0000000000000000000000000000000000000000",
          curatorSafeDetails: vault.curatorSafeDetails ?? { isSafe: false },
          publicAllocatorIsAllocator:
            Array.isArray(vault.allocators) &&
            vault.allocators.includes(publicAllocator.publicAllocator),
          isWhitelisted: Boolean(vault.isWhitelisted),
        };
      } catch (error) {
        console.error("Error processing vault:", vault, error);
        return null;
      }
    })
    .filter((vault): vault is NonNullable<typeof vault> => vault !== null);

  return sortVaults(processedVaults);
};

// Helper functions
const processMarkets = (vault: MetaMorphoVaultData): MarketFlowCaps[] => {
  return vault.markets.map((market) => {
    const maxInUsd =
      +formatUnits(market.flowCaps.maxIn, Number(vault.asset.decimals)) *
      vault.asset.priceUsd;
    const maxOutUsd =
      +formatUnits(market.flowCaps.maxOut, Number(vault.asset.decimals)) *
      vault.asset.priceUsd;
    const supplyAssetsUsd =
      +formatUnits(market.supplyAssets, Number(vault.asset.decimals)) *
      vault.asset.priceUsd;

    return {
      id: market.id,
      idle: market.idle ?? false,
      link: { name: market.link.name, url: market.link.url },
      maxInUsd:
        market.flowCaps.maxIn === MaxUint128
          ? "MAX"
          : formatUsdAmount(maxInUsd),
      maxOutUsd: formatUsdAmount(maxOutUsd),
      supplyAssetsFormatted: formatTokenAmount(
        market.supplyAssets,
        vault.asset
      ),
      supplyAssetsUsd,
      supplyAssetsUsdFormatted:
        market.flowCaps.maxOut === MaxUint128
          ? "MAX"
          : formatUsdAmount(supplyAssetsUsd),
      supplyCapUsd:
        market.supplyCap === MaxUint184
          ? "MAX"
          : formatUsdAmount(
              +formatUnits(market.supplyCap, Number(vault.asset.decimals)) *
                vault.asset.priceUsd
            ),
      missing:
        maxInUsd < USD_FLOWCAP_THRESHOLD || maxOutUsd < USD_FLOWCAP_THRESHOLD,
    };
  });
};

const generateWarnings = (
  markets: MarketFlowCaps[],
  vault: MetaMorphoVaultData
): VaultWarnings => {
  // Find the idle market from the withdraw queue
  const idleMarketFromWithdrawQueue = vault.withdrawQueue.find(
    (market) => market.idle
  );
  const idleMarketId = idleMarketFromWithdrawQueue?.id;

  // Check if the idle market is in the supply queue
  const idleMarketInSupplyQueue = vault.supplyQueue.find(
    (market) => market.id === idleMarketId && market.idle
  );

  let idleSupplyQueueWarningReason: string | undefined;
  let idlePositionSupplyQueue = false;
  let supplyQueueStatus = "OK";

  // Handle supply queue warnings
  const len = vault.supplyQueue.length;

  if (len === 0) {
    // Empty supply queue
    supplyQueueStatus = "Empty";
    idlePositionSupplyQueue = true;
  } else {
    // Supply queue has elements
    const isIdleMarketAlone = len === 1 && idleMarketInSupplyQueue;

    if (!idleMarketInSupplyQueue) {
      // No idle market in supply queue
      idlePositionSupplyQueue = true;
      idleSupplyQueueWarningReason = "deprecated";
      supplyQueueStatus = "No Idle market in supply queue";
    } else if (!isIdleMarketAlone) {
      // Idle market is present but not alone
      idlePositionSupplyQueue = true;
      idleSupplyQueueWarningReason = "wrong_order";
      supplyQueueStatus = "Idle market not alone";
    }
  }

  return {
    missingFlowCaps: !markets.every((market) => !market.missing),
    allCapsTo0: markets.every((market) => market.missing),
    idlePositionWithdrawQueue:
      vault.withdrawQueue.length > 0 && !vault.withdrawQueue[0].idle,
    idlePositionSupplyQueue,
    idleSupplyQueueWarningReason,
    supplyQueueStatus,
  };
};

const formatVaultInfo = (vault: MetaMorphoVaultData, networkId: number) => ({
  address: vault.address,
  link: {
    url: formatVaultLink(vault.address, networkId),
    name: vault.name,
  },
  asset: vault.asset,
  totalAssetsUsd: vault.totalAssetsUsd,
});

const isV1_1Factory = (factoryAddress: string, networkId: number) =>
  factoryAddress?.toLowerCase() ===
  FACTORY_ADDRESSES_V1_1[
    networkId as keyof typeof FACTORY_ADDRESSES_V1_1
  ].toLowerCase();

const sortVaults = (vaults: VaultData[]) => {
  return vaults.sort((a, b) => b.vault.totalAssetsUsd - a.vault.totalAssetsUsd);
};

const sortMarkets = (vaults: MarketFlowCaps[]) => {
  return vaults
    .sort((a, b) => b.supplyAssetsUsd - a.supplyAssetsUsd)
    .sort((a, b) => {
      if (a.missing && !b.missing) {
        return -1;
      } else if (!a.missing && b.missing) {
        return 1;
      }
      return 0;
    });
};

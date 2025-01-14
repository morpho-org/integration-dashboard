import { formatUnits } from "ethers";
import { MarketFlowCaps, MetaMorphoVaultData, VaultData } from "../utils/types";
import {
  FACTORY_ADDRESSES_V1_1,
  MaxUint128,
  MaxUint184,
  USD_FLOWCAP_THRESHOLD,
  vaultBlacklist,
} from "../config/constants";
import {
  formatTokenAmount,
  formatUsdAmount,
  formatVaultLink,
  getProvider,
} from "../utils/utils";
import {
  fetchPublicAllocator,
  fetchStrategies,
  fetchVaultData,
  fetchWhitelistedMetaMorphos,
} from "../fetchers/apiFetchers";
import { MulticallWrapper } from "ethers-multicall-provider";

export const getVaultDisplayData = async (
  networkId: number
): Promise<VaultData[]> => {
  // Fetch data in parallel
  const [strategies, whitelistedMMs, publicAllocator] = await Promise.all([
    fetchStrategies(networkId),
    fetchWhitelistedMetaMorphos(networkId),
    fetchPublicAllocator(networkId),
  ]);

  console.log("networkId in vaultData", networkId);

  const provider = MulticallWrapper.wrap(getProvider(networkId));

  console.log("provider in vaultData", provider);
  // Filter blacklisted vaults
  const whitelistedVaults = whitelistedMMs.filter(
    (vault) => !vaultBlacklist[networkId]!.includes(vault.address)
  );

  // Fetch all vault data in parallel
  const vaultData = await Promise.all(
    whitelistedVaults.map((vault) =>
      fetchVaultData(vault.address, networkId, strategies, provider)
    )
  );

  // Process vault data
  const processedVaults = vaultData.map((vault) => {
    const markets = processMarkets(vault);
    const warnings = generateWarnings(markets, vault);

    return {
      isV1_1: vault.factoryAddress
        ? isV1_1Factory(vault.factoryAddress, networkId)
        : false,
      timelock: vault.timelock,
      vault: formatVaultInfo(vault, networkId),
      markets: sortMarkets(markets),
      warnings,
      curators: vault.curators,
      supplyQueue: vault.supplyQueue,
      withdrawQueue: vault.withdrawQueue,
      owner: vault.owner,
      ownerSafeDetails: vault.ownerSafeDetails,
      curator: vault.curator,
      curatorSafeDetails: vault.curatorSafeDetails,
      publicAllocatorIsAllocator: vault.allocators.includes(
        publicAllocator.publicAllocator
      ),
    };
  });

  return sortVaults(processedVaults);
};

// Helper functions
const processMarkets = (vault: MetaMorphoVaultData): MarketFlowCaps[] => {
  return vault.markets.map((market) => {
    const maxInUsd =
      +formatUnits(market.flowCaps.maxIn, vault.asset.decimals) *
      vault.asset.priceUsd;
    const maxOutUsd =
      +formatUnits(market.flowCaps.maxOut, vault.asset.decimals) *
      vault.asset.priceUsd;
    const supplyAssetsUsd =
      +formatUnits(market.supplyAssets, vault.asset.decimals) *
      vault.asset.priceUsd;

    return {
      id: market.id,
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
              +formatUnits(market.supplyCap, vault.asset.decimals) *
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
) => ({
  missingFlowCaps: !markets.every((market) => !market.missing),
  allCapsTo0: markets.every((market) => market.missing),
  idlePositionWithdrawQueue: !vault.withdrawQueue[0].idle,
  idlePositionSupplyQueue:
    vault.supplyQueue.every((market) => !market.idle) ||
    !vault.supplyQueue[vault.supplyQueue.length - 1].idle,
});

const formatVaultInfo = (vault: MetaMorphoVaultData, networkId: number) => ({
  address: vault.address,
  link: {
    url: formatVaultLink(vault.address, networkId),
    name: vault.name,
  },
  asset: vault.asset,
  totalAssetsUsd: vault.totalAssets * vault.asset.priceUsd,
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

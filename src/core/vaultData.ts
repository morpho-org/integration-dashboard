import { formatUnits } from "ethers";
import { MarketFlowCaps, VaultData } from "../utils/types";
import {
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
  const strategies = await fetchStrategies(networkId);

  const provider = MulticallWrapper.wrap(getProvider(networkId));

  const whitelistedVaults = (
    await fetchWhitelistedMetaMorphos(networkId)
  ).filter((vault) => !vaultBlacklist[networkId]!.includes(vault.address));

  const vaults = await Promise.all(
    whitelistedVaults.map((vault) =>
      fetchVaultData(vault.address, networkId, strategies, provider)
    )
  );

  const publicAllocator = await fetchPublicAllocator(networkId);

  const missingFlowCaps = [];

  for (const vault of vaults) {
    const markets: MarketFlowCaps[] = vault.markets.map((market) => {
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
        link: {
          name: market.link.name,
          url: market.link.url,
        },
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

    const warnings = {
      missingFlowCaps: !markets.every((market) => !market.missing),
      allCapsTo0: markets.every((market) => market.missing),
      idlePositionWithdrawQueue: !vault.withdrawQueue[0].idle,
      idlePositionSupplyQueue:
        vault.supplyQueue.every((market) => !market.idle) ||
        !vault.supplyQueue[vault.supplyQueue.length - 1].idle,
    };

    const publicAllocatorIsAllocator = vault.allocators.includes(
      publicAllocator.publicAllocator
    );
    missingFlowCaps.push({
      vault: {
        address: vault.address,
        link: {
          url: formatVaultLink(vault.address, networkId),
          name: vault.name,
        },
        asset: vault.asset,
        totalAssetsUsd: vault.totalAssets * vault.asset.priceUsd,
      },
      curators: vault.curators,
      markets: sortMarkets(markets),
      supplyQueue: vault.supplyQueue,
      withdrawQueue: vault.withdrawQueue,
      warnings,
      owner: vault.owner,
      ownerSafeDetails: vault.ownerSafeDetails,
      curator: vault.curator,
      curatorSafeDetails: vault.curatorSafeDetails,
      publicAllocatorIsAllocator,
    });
  }

  return sortVaults(missingFlowCaps);
};

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

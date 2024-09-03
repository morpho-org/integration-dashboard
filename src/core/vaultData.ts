import { formatUnits } from "ethers";
import { MarketFlowCaps, VaultMissingFlowCaps } from "../utils/types";
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
  fetchStrategies,
  fetchVaultFlowCapsData,
  fetchWhitelistedMetaMorphos,
} from "../fetchers/apiFetchers";
import { MulticallWrapper } from "ethers-multicall-provider";

export const getVaultDisplayData = async (
  networkId: number
): Promise<VaultMissingFlowCaps[]> => {
  console.log("fetching strategies");

  const strategies = await fetchStrategies(networkId);

  const provider = MulticallWrapper.wrap(getProvider(networkId));

  console.log("fetching whitelisted vaults");

  const whitelistedVaults = (
    await fetchWhitelistedMetaMorphos(networkId)
  ).filter((vault) => !vaultBlacklist[networkId]!.includes(vault.address));

  console.log("fetching vaults data");

  const vaults = await Promise.all(
    whitelistedVaults.map((vault) =>
      fetchVaultFlowCapsData(vault.address, networkId, strategies, provider)
    )
  );

  console.log("vault data fetched");

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
        name: market.name,
        link: market.link,
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
      idlePositionWithdrawQueue: !vault.withdrawQueue[0].idle,
      idlePositionSupplyQueue:
        vault.supplyQueue.every((market) => !market.idle) ||
        !vault.supplyQueue[vault.supplyQueue.length - 1].idle,
    };

    missingFlowCaps.push({
      vault: {
        name: vault.name,
        link: formatVaultLink(vault.address, networkId),
        asset: vault.asset,
        totalAssetsUsd: vault.totalAssets * vault.asset.priceUsd,
      },
      markets: sortMarkets(markets),
      supplyQueue: vault.supplyQueue,
      withdrawQueue: vault.withdrawQueue,
      warnings,
    });
  }

  console.log("everithing fetched");

  return sortVaults(missingFlowCaps);
};

const sortVaults = (vaults: VaultMissingFlowCaps[]) => {
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

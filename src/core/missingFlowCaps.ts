import { formatUnits, id, Provider } from "ethers";
import { fetchFlowCaps } from "../fetchers/chainFetcher";
import { VaultDisplayData, VaultMissingFlowCaps } from "../utils/types";
import { USD_FLOWCAP_THRESHOLD } from "../config/constants";
import { get } from "http";
import {
  formatMarketLink,
  formatVaultLink,
  getMarketName,
  getProvider,
} from "../utils/utils";
import {
  fetchVaultData,
  fetchWhitelistedMetaMorphos,
} from "../fetchers/apiFetchers";
import { MulticallWrapper } from "ethers-multicall-provider";

export const getMissingFlowCaps = async (
  networkId: number
): Promise<VaultMissingFlowCaps[]> => {
  const provider = MulticallWrapper.wrap(getProvider(networkId));

  console.log("fetching whitelisted vaults");

  const whitelistedVaults = await fetchWhitelistedMetaMorphos(networkId);

  console.log("fetching vaults data");

  const vaults = await Promise.all(
    whitelistedVaults.map((vault) =>
      fetchVaultData(vault.address, networkId, provider)
    )
  );

  console.log("vault data fetched");

  const missingFlowCaps = [];

  for (const vault of vaults) {
    const marketsWithMissingFlowCaps = [];

    for (const market of vault.markets) {
      const flowCaps = market.flowCaps;

      const maxInUsd =
        +formatUnits(flowCaps.maxIn, vault.asset.decimals) *
        vault.asset.priceUsd;
      const maxOutUsd =
        +formatUnits(flowCaps.maxOut, vault.asset.decimals) *
        vault.asset.priceUsd;
      if (
        maxInUsd < USD_FLOWCAP_THRESHOLD ||
        maxOutUsd < USD_FLOWCAP_THRESHOLD
      ) {
        const missingFlowCaps = {
          id: market.id,
          name: market.name,
          link: formatMarketLink(market.id, networkId),
          maxInUsd: maxInUsd < USD_FLOWCAP_THRESHOLD ? maxInUsd : undefined,
          maxOutUsd: maxOutUsd < USD_FLOWCAP_THRESHOLD ? maxOutUsd : undefined,
        };
        marketsWithMissingFlowCaps.push(missingFlowCaps);
      }
    }

    if (marketsWithMissingFlowCaps.length > 0) {
      missingFlowCaps.push({
        vault: {
          name: vault.name,
          link: formatVaultLink(vault.address, networkId),
          asset: vault.asset,
          totalAssetsUsd: vault.totalAssets * vault.asset.priceUsd,
        },
        marketsWithMissingFlowCaps,
      });
    }
  }

  console.log("everithing fetched");

  return missingFlowCaps;
};

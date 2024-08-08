import { formatUnits, id, Provider } from "ethers";
import { fetchFlowCaps } from "../fetchers/chainFetcher";
import {
  MarketFlowCaps,
  VaultDisplayData,
  VaultMissingFlowCaps,
} from "../utils/types";
import { USD_FLOWCAP_THRESHOLD } from "../config/constants";
import { get } from "http";
import {
  formatMarketLink,
  formatUsdAmount,
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
    const markets: MarketFlowCaps[] = vault.markets.map((market) => {
      const maxInUsd =
        +formatUnits(market.flowCaps.maxIn, vault.asset.decimals) *
        vault.asset.priceUsd;
      const maxOutUsd =
        +formatUnits(market.flowCaps.maxOut, vault.asset.decimals) *
        vault.asset.priceUsd;
      return {
        id: market.id,
        name: market.name,
        link: market.link,
        maxInUsd: formatUsdAmount(maxInUsd),
        maxOutUsd: formatUsdAmount(maxOutUsd),
        missing:
          maxInUsd < USD_FLOWCAP_THRESHOLD || maxOutUsd < USD_FLOWCAP_THRESHOLD,
      };
    });

    missingFlowCaps.push({
      vault: {
        name: vault.name,
        link: formatVaultLink(vault.address, networkId),
        asset: vault.asset,
        totalAssetsUsd: vault.totalAssets * vault.asset.priceUsd,
      },
      markets,
    });
  }

  console.log("everithing fetched");

  return missingFlowCaps;
};

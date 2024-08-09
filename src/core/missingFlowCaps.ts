import { formatUnits } from "ethers";
import { MarketFlowCaps, VaultMissingFlowCaps } from "../utils/types";
import {
  MaxUint128,
  MaxUint184,
  USD_FLOWCAP_THRESHOLD,
} from "../config/constants";
import { formatUsdAmount, formatVaultLink, getProvider } from "../utils/utils";
import {
  fetchVaultFlowCapsData,
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
      fetchVaultFlowCapsData(vault.address, networkId, provider)
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
        maxInUsd:
          market.flowCaps.maxIn === MaxUint128
            ? "MAX"
            : formatUsdAmount(maxInUsd),
        maxOutUsd: formatUsdAmount(maxOutUsd),
        supplyAssetsUsd:
          market.flowCaps.maxOut === MaxUint128
            ? "MAX"
            : formatUsdAmount(
                +formatUnits(market.supplyAssets, vault.asset.decimals) *
                  vault.asset.priceUsd
              ),
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

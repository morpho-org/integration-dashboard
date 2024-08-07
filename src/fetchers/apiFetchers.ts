import { Provider } from "ethers";
import { BLUE_API, TARGET_API, WHITELIST_API } from "../config/constants";
import { MetaMorphoVault, Strategy, WhitelistedVault } from "../utils/types";
import { formatMarketLink, getMarketName } from "../utils/utils";
import { fetchFlowCaps } from "./chainFetcher";

export const fetchStrategies = async (): Promise<Strategy[]> => {
  try {
    const res = await fetch(TARGET_API);
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
  provider: Provider
): Promise<MetaMorphoVault> => {
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
          }
        }
      }
    }
  }
  `;

  const response = await fetch(BLUE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { vault: vaultAddress } }),
  });
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
      });
      return acc;
    },
    []
  );

  const markets = await Promise.all(
    enabledMarkets.map(async (market: { id: string; name: string }) => {
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
      };
    })
  );

  return {
    symbol: vault.symbol,
    address: vault.address,
    name: vault.name,
    asset: vault.asset,
    totalAssets: vault.state.totalAssets,
    markets,
  };
};

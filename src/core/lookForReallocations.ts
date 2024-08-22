import { sortVaultReallocationData } from "./../utils/utils";
import { Provider } from "ethers";
import { MorphoBlue__factory } from "ethers-types";
import { MulticallWrapper } from "ethers-multicall-provider";
import {
  MetaMorphoAPIData,
  MetaMorphoPosition,
  MetaMorphoVault,
  OutOfBoundsMarket,
  Strategy,
  VaultReallocationData,
} from "../utils/types";
import { getProvider } from "../utils/utils";
import {
  fetchStrategies,
  fetchSupplingVaultsData,
} from "../fetchers/apiFetchers";
import { MORPHO } from "../config/constants";
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

export const lookForReallocations = async (
  networkId: number,
  outOfBoundsMarket: OutOfBoundsMarket
) => {
  const provider = MulticallWrapper.wrap(getProvider(networkId));

  const [supplyingVaultsApiData, strategies] = await Promise.all([
    fetchSupplingVaultsData(outOfBoundsMarket.id),
    fetchStrategies(networkId),
  ]);

  const supplyingVaults = await Promise.all(
    supplyingVaultsApiData.map((vault) =>
      initializeSupplyingVault(
        vault,
        outOfBoundsMarket.id,
        strategies,
        provider,
        networkId
      )
    )
  );

  const vaultReallocationData: VaultReallocationData[] = supplyingVaults.map(
    (vault) => {
      return {
        supplyReallocation: outOfBoundsMarket.aboveRange,
        vault,
        marketReallocationData: getMarketReallocationData(
          vault,
          outOfBoundsMarket.amountToReachTarget,
          outOfBoundsMarket.aboveRange
        ),
        reallocation: outOfBoundsMarket.aboveRange
          ? seekForSupplyReallocation(outOfBoundsMarket.id, vault)
          : seekForWithdrawReallocation(outOfBoundsMarket.id, vault),
      };
    }
  );

  return sortVaultReallocationData(vaultReallocationData);
};

const initializeSupplyingVault = async (
  vaultData: MetaMorphoAPIData,
  reallocationMarketId: string,
  strategies: Strategy[],
  provider: Provider,
  networkId: number
): Promise<MetaMorphoVault> => {
  const morpho = MorphoBlue__factory.connect(MORPHO, provider);
  const name = vaultData.name;
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
    provider,
    reallocationMarketId,
    vaultData.address
  );

  const marketData = await Promise.all(
    Object.keys(supplyPositions).map((marketId) =>
      getVaultMarketData(
        marketId,
        underlyingAsset,
        strategies,
        morpho,
        provider
      )
    )
  );

  const positions: { [key: string]: MetaMorphoPosition } = {};

  for (let i = 0; i < Object.keys(supplyPositions).length; i++) {
    positions[Object.keys(supplyPositions)[i]] = {
      marketData: marketData[i],
      supplyAssets:
        supplyPositions[Object.keys(supplyPositions)[i]].supplyAssets,
      supplyCap: supplyPositions[Object.keys(supplyPositions)[i]].supplyCap,
    };
  }

  const flowCaps = await getFlowCaps(
    vaultData.address,
    Object.keys(positions),
    networkId,
    provider
  );
  const totalAssetsUsd =
    (underlyingAsset.priceUsd * vaultData.state.totalAssets) /
    10 ** Number(underlyingAsset.decimals);

  return {
    address: vaultData.address,
    name,
    underlyingAsset,
    totalAssetsUsd,
    positions,
    flowCaps: flowCaps,
  };
};

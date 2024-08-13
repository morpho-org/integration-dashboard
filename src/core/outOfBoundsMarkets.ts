import { MulticallWrapper } from "ethers-multicall-provider";
import { fetchMarketAssets, fetchStrategies } from "../fetchers/apiFetchers";
import { fetchMarketParamsAndData } from "../fetchers/chainFetcher";
import { OutOfBoundsMarket } from "../utils/types";
import {
  formatMarketLink,
  getMarketName,
  getProvider,
  isApyOutOfRange,
  isUtilizationOutOfRange,
} from "../utils/utils";
import { computeUtilization } from "../utils/maths";
import { formatUnits } from "ethers";

export const getOutOfBoundsMarkets = async (
  networkId: number
): Promise<OutOfBoundsMarket[]> => {
  const provider = MulticallWrapper.wrap(getProvider(networkId));

  console.log("fetching strategies");

  const strategies = await fetchStrategies(networkId);

  console.log("fetching market data");

  const whitelistedMarkets = await Promise.all(
    strategies.map(async (strategy) => {
      const [
        { loanAsset, collateralAsset },
        { marketParams, marketChainData },
      ] = await Promise.all([
        fetchMarketAssets(strategy.id),
        fetchMarketParamsAndData(strategy.id, provider),
      ]);
      return {
        id: strategy.id,
        strategy: strategy,
        loanAsset,
        collateralAsset,
        marketParams,
        marketChainData,
      };
    })
  );

  const outOfBoundsMarkets: OutOfBoundsMarket[] = [];

  for (const market of whitelistedMarkets) {
    const utilization = computeUtilization(
      market.marketChainData.marketState.totalBorrowAssets,
      market.marketChainData.marketState.totalSupplyAssets
    );
    if (
      market.strategy.apyRange &&
      isApyOutOfRange(market.marketChainData.apys, market.strategy.apyRange)
    ) {
      outOfBoundsMarkets.push({
        id: market.id,
        name: getMarketName(
          market.loanAsset.symbol,
          market.collateralAsset.symbol,
          market.marketParams.lltv
        ),
        link: formatMarketLink(market.id, networkId),
        totalSupplyUsd:
          +formatUnits(
            market.marketChainData.marketState.totalBorrowAssets,
            market.loanAsset.decimals
          ) * market.loanAsset.priceUsd,
        loanAsset: market.loanAsset,
        collateralAsset: market.collateralAsset,
        utilization,
        apys: market.marketChainData.apys,
        target: {
          apyTarget: market.strategy.targetBorrowApy!,
          apyRange: market.strategy.apyRange!,
        },
      });
    }
    if (
      market.strategy.utilizationRange &&
      isUtilizationOutOfRange(utilization, market.strategy.utilizationRange)
    ) {
      outOfBoundsMarkets.push({
        id: market.id,
        name: getMarketName(
          market.loanAsset.symbol,
          market.collateralAsset.symbol,
          market.marketParams.lltv
        ),
        link: formatMarketLink(market.id, networkId),
        totalSupplyUsd:
          +formatUnits(
            market.marketChainData.marketState.totalBorrowAssets,
            market.loanAsset.decimals
          ) * market.loanAsset.priceUsd,
        loanAsset: market.loanAsset,
        collateralAsset: market.collateralAsset,
        utilization,
        apys: market.marketChainData.apys,
        target: {
          utilizationTarget: market.strategy.utilizationTarget!,
          utilizationRange: market.strategy.utilizationRange,
        },
      });
    }
  }
  return outOfBoundsMarkets;
};

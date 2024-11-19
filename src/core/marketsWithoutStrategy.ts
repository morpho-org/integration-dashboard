import {
  fetchMarketWithoutStrategyData,
  fetchStrategies,
} from "../fetchers/apiFetchers";
import { MarketWithoutStrategy, Strategy } from "../utils/types";
import { formatMarketLink, getMarketName } from "../utils/utils";

export const getMarketsWithoutStrategy = async (
  networkId: number
): Promise<MarketWithoutStrategy[]> => {
  console.log("fetching strategies");

  const strategies = await fetchStrategies(networkId);

  console.log("strategies fetched");

  const marketWithoutStrategies = strategies.filter((strategy) =>
    isMarketStrategyless(strategy)
  );
  console.log("fetching market data");

  const marketData = await Promise.all(
    marketWithoutStrategies.map(async (strategy) =>
      fetchMarketWithoutStrategyData(strategy.id)
    )
  );

  console.log("market data fetched");

  return marketData.map((market) => {
    return {
      id: market.uniqueKey,
      link: {
        url: formatMarketLink(market.uniqueKey, networkId),
        name: getMarketName(
          market.loanAsset.symbol,
          market.collateralAsset ? market.collateralAsset.symbol : null,
          market.lltv
        ),
      },
      loanAsset: market.loanAsset,
      collateralAsset: market.collateralAsset,
    };
  });
};

const isMarketStrategyless = (strategy: Strategy) => {
  const idle = strategy.idleMarket;
  const blacklist = strategy.blacklist;
  const withoutTarget =
    (strategy.targetBorrowApy === undefined ||
      strategy.targetBorrowApy === null) &&
    strategy.utilizationTarget === undefined;
  const zeroApyTarget =
    strategy.targetBorrowApy !== undefined &&
    strategy.targetBorrowApy !== null &&
    BigInt(strategy.targetBorrowApy) === 0n;
  const zeroUtilizationTarget =
    strategy.utilizationTarget !== undefined &&
    BigInt(strategy.utilizationTarget) === 0n;

  return (
    !idle &&
    !blacklist &&
    (withoutTarget || zeroApyTarget || zeroUtilizationTarget)
  );
};

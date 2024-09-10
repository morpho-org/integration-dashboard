import { MulticallWrapper } from "ethers-multicall-provider";
import {
  fetchMarketWithoutStrategyData,
  fetchStrategies,
} from "../fetchers/apiFetchers";
import { MarketWithoutStrategy } from "../utils/types";
import { formatMarketLink, getMarketName, getProvider } from "../utils/utils";

export const getMarketsWithoutStrategy = async (
  networkId: number
): Promise<MarketWithoutStrategy[]> => {
  console.log("fetching strategies");

  const strategies = await fetchStrategies(networkId);

  const marketWithoutStrategies = strategies.filter(
    (strategy) =>
      (!strategy.blacklist &&
        !strategy.idleMarket &&
        strategy.targetBorrowApy !== undefined &&
        BigInt(strategy.targetBorrowApy) === 0n) ||
      (strategy.utilizationTarget !== undefined &&
        BigInt(strategy.utilizationTarget) === 0n)
  );

  console.log("fetching market data");

  const marketData = await Promise.all(
    marketWithoutStrategies.map(async (strategy) =>
      fetchMarketWithoutStrategyData(strategy.id)
    )
  );

  return marketData.map((market) => {
    return {
      id: market.uniqueKey,
      name: getMarketName(
        market.loanAsset.symbol,
        market.collateralAsset ? market.collateralAsset.symbol : null,
        market.lltv
      ),
      link: formatMarketLink(market.uniqueKey, networkId),
      loanAsset: market.loanAsset,
      collateralAsset: market.collateralAsset,
    };
  });
};

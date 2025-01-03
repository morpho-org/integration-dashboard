import {
  abs,
  computeSupplyValue,
  computeWithdrawValue,
  wDivDown,
} from "./../utils/maths";
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

  const strategies = await fetchStrategies(networkId);

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

  console.log("whitelisted markets fetched");

  const outOfBoundsMarkets: OutOfBoundsMarket[] = [];

  for (const market of whitelistedMarkets) {
    console.log(market.id);

    const utilization = computeUtilization(
      market.marketChainData.marketState.totalBorrowAssets,
      market.marketChainData.marketState.totalSupplyAssets
    );

    console.log("utilization:", utilization);

    if (market.strategy.blacklist || market.strategy.idleMarket) continue;

    console.log("checking market");

    if (
      market.strategy.apyRange &&
      isApyOutOfRange(market.marketChainData.apys, market.strategy.apyRange)
    ) {
      console.log("apy out of range");

      if (
        !market.strategy.targetBorrowApy ||
        BigInt(market.strategy.targetBorrowApy) === 0n
      )
        continue;

      console.log("target apy not 0");

      const aboveRange =
        market.marketChainData.apys.borrowApy >
        market.strategy.apyRange.upperBound;

      aboveRange ? console.log("above range") : console.log("below range");

      const amountToReachTarget = aboveRange
        ? computeSupplyValue(
            market.marketChainData,
            BigInt(market.strategy.targetBorrowApy!)
          ).amount
        : computeWithdrawValue(
            market.marketChainData,
            market.strategy.targetBorrowApy!
          ).amount;

      console.log("amount to reach target", amountToReachTarget);

      outOfBoundsMarkets.push({
        id: market.id,
        link: {
          url: formatMarketLink(market.id, networkId),
          name: getMarketName(
            market.loanAsset.symbol,
            market.collateralAsset.symbol,
            market.marketParams.lltv
          ),
        },
        totalSupplyUsd:
          +formatUnits(
            market.marketChainData.marketState.totalBorrowAssets,
            market.loanAsset.decimals
          ) * market.loanAsset.priceUsd,
        loanAsset: market.loanAsset,
        collateralAsset: market.collateralAsset,
        utilization,
        marketChainData: market.marketChainData,
        target: {
          apyTarget: market.strategy.targetBorrowApy!,
          apyRange: market.strategy.apyRange!,
          distanceToTarget: wDivDown(
            abs(
              BigInt(market.strategy.targetBorrowApy!) -
                market.marketChainData.apys.borrowApy
            ),
            BigInt(market.strategy.targetBorrowApy!)
          ),
          upperBoundCrossed: aboveRange,
        },
        amountToReachTarget,
        aboveRange,
      });
    }
    if (
      market.strategy.utilizationRange &&
      isUtilizationOutOfRange(utilization, market.strategy.utilizationRange)
    ) {
      console.log("utilization out of range");

      if (BigInt(market.strategy.utilizationTarget!) === 0n) continue;
      const utilizationTarget = BigInt(market.strategy.utilizationTarget!);
      const aboveRange =
        utilization > market.strategy.utilizationRange.upperBound;
      const amountToReachTarget = aboveRange
        ? wDivDown(
            market.marketChainData.marketState.totalBorrowAssets,
            utilizationTarget
          ) - market.marketChainData.marketState.totalSupplyAssets
        : market.marketChainData.marketState.totalSupplyAssets -
          wDivDown(
            market.marketChainData.marketState.totalBorrowAssets,
            utilizationTarget
          );
      outOfBoundsMarkets.push({
        id: market.id,

        link: {
          url: formatMarketLink(market.id, networkId),
          name: getMarketName(
            market.loanAsset.symbol,
            market.collateralAsset.symbol,
            market.marketParams.lltv
          ),
        },
        totalSupplyUsd:
          +formatUnits(
            market.marketChainData.marketState.totalBorrowAssets,
            market.loanAsset.decimals
          ) * market.loanAsset.priceUsd,
        loanAsset: market.loanAsset,
        collateralAsset: market.collateralAsset,
        utilization,
        marketChainData: market.marketChainData,
        target: {
          utilizationTarget: market.strategy.utilizationTarget!,
          utilizationRange: market.strategy.utilizationRange,
          distanceToTarget: wDivDown(
            abs(BigInt(market.strategy.utilizationTarget!) - utilization),
            BigInt(market.strategy.utilizationTarget!)
          ),
          upperBoundCrossed: aboveRange,
        },
        amountToReachTarget,
        aboveRange,
      });
    }
    console.log("in range");
  }

  return outOfBoundsMarkets.sort(
    (a, b) =>
      Number(b.target.distanceToTarget) - Number(a.target.distanceToTarget)
  );
};

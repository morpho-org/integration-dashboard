import {
  abs,
  computeSupplyValue,
  computeWithdrawValue,
  wDivDown,
} from "./../utils/maths";
import { fetchMarketAssets, fetchStrategies } from "../fetchers/apiFetchers";
import { fetchMarketParamsAndData } from "../fetchers/chainFetcher";
import { OutOfBoundsMarket } from "../utils/types";
import {
  formatMarketLink,
  getMarketName,
  isApyOutOfRange,
  isUtilizationOutOfRange,
} from "../utils/utils";
import { computeUtilization } from "../utils/maths";
import { formatUnits, PublicClient, withRetry } from "viem";
import { initializeClient } from "../utils/client";

const BATCH_SIZE = 25;

const fetchMarketDataWithRetry = async (
  strategy: any,
  client: PublicClient
): Promise<any> => {
  const [{ loanAsset, collateralAsset }, { marketParams, marketChainData }] =
    await Promise.all([
      fetchMarketAssets(strategy.id, client.chain?.id!),
      withRetry(() => fetchMarketParamsAndData(client, strategy.id)),
    ]);

  return {
    id: strategy.id,
    strategy,
    loanAsset,
    collateralAsset,
    marketParams,
    marketChainData,
  };
};

export const getOutOfBoundsMarkets = async (
  networkId: number
): Promise<OutOfBoundsMarket[]> => {
  const [{ client: clientMainnet }, { client: clientBase }, { client: clientPolygon }, { client: clientUnichain }] = await Promise.all(
    [initializeClient(1), initializeClient(8453), initializeClient(137), initializeClient(130)]
  );

  let client: PublicClient;
  if (networkId === 1) {
    client = clientMainnet;
  } else if (networkId === 8453) {
    client = clientBase;
  } else if (networkId === 137) {
    client = clientPolygon;
  } else if (networkId === 130) {
    client = clientUnichain;
  }

  const strategies = await fetchStrategies(networkId);

  // Fetch market data in batches with retry mechanism
  const whitelistedMarkets = [];
  for (let i = 0; i < strategies.length; i += BATCH_SIZE) {
    console.log("fetching batch", i);
    const batch = strategies.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((strategy) => fetchMarketDataWithRetry(strategy, client))
    );
    whitelistedMarkets.push(
      ...batchResults.filter((result) => result !== undefined)
    );
  }

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
            Number(market.loanAsset.decimals)
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
            Number(market.loanAsset.decimals)
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

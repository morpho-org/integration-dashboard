import "evm-maths";
import { maxUint256, zeroAddress } from "viem";
import {
    ADJUSTMENT_SPEED,
    CURVE_STEEPNESS,
    LN_2_INT,
    LN_WEI_INT,
    MAX_RATE_AT_TARGET,
    MIN_RATE_AT_TARGET,
    REALLOCATION_DIST_THRESHOLD,
    REALLOCATION_THRESHOLD_PERCENT,
    TARGET_UTILIZATION,
    VIRTUAL_ASSETS,
    VIRTUAL_SHARES,
    WAD,
    WEXP_UPPER_BOUND,
    WEXP_UPPER_VALUE,
    YEAR
} from "../config/constants";
import {
    InteractionData,
    MarketChainData,
    MarketState,
    Strategy
} from "./types";

export const pow10 = (exponant: bigint | number) => 10n ** BigInt(exponant);

export const min = (a: bigint, b: bigint) => (a < b ? a : b);
export const max = (a: bigint, b: bigint) => (a < b ? b : a);
export const abs = (x: bigint) => (x < 0n ? -x : x);

export const mulDivDown = (x: bigint, y: bigint, d: bigint): bigint =>
  (x * y) / d;
export const mulDivUp = (x: bigint, y: bigint, d: bigint): bigint =>
  (x * y + (d - 1n)) / d;
export const wDivDown = (x: bigint, y: bigint): bigint => mulDivDown(x, WAD, y);
export const wMulDown = (x: bigint, y: bigint): bigint => mulDivDown(x, y, WAD);

export const wTaylorCompounded = (x: bigint, n: bigint): bigint => {
  const firstTerm = x * n;
  const secondTerm = mulDivDown(firstTerm, firstTerm, 2n * WAD);
  const thirdTerm = mulDivDown(secondTerm, firstTerm, 3n * WAD);
  return firstTerm + secondTerm + thirdTerm;
};

export const getPercentsOf = (x: bigint, percent: bigint | number): bigint => {
  return wMulDown(x, BigInt(percent) * pow10(16));
};

export const percentToWad = (percentage: number): bigint => {
  return isFinite(percentage) ? BigInt(percentage * 1e16) : 0n;
};

export const computeAvailableLiquididty = (marketState: MarketState) =>
  marketState.totalSupplyAssets - marketState.totalBorrowAssets;

export const toSharesDown = (
  assets: bigint,
  totalAssets: bigint,
  totalShares: bigint
): bigint => {
  return mulDivDown(
    assets,
    totalShares + VIRTUAL_SHARES,
    totalAssets + VIRTUAL_ASSETS
  );
};

export const toAssetsDown = (
  shares: bigint,
  totalAssets: bigint,
  totalShares: bigint
): bigint => {
  return mulDivDown(
    shares,
    totalAssets + VIRTUAL_ASSETS,
    totalShares + VIRTUAL_SHARES
  );
};

const wExp = (x: bigint): bigint => {
  if (x < LN_WEI_INT) return 0n;
  if (x >= WEXP_UPPER_BOUND) return WEXP_UPPER_VALUE;
  const roundingAdjustment = x < 0n ? -(LN_2_INT / 2n) : LN_2_INT / 2n;
  const q = (x + roundingAdjustment) / LN_2_INT;
  const r = x - q * LN_2_INT;
  const expR = WAD + r + (r * r) / WAD / 2n;
  if (q >= 0) return expR << q;
  else return expR >> -q;
};

export const computeRateAtTarget = (
  market: MarketState,
  startRateAtTarget: bigint,
  timestamp: bigint
): bigint => {
  const utilization = computeUtilization(
    market.totalBorrowAssets,
    market.totalSupplyAssets
  );
  const errNormFactor =
    utilization > TARGET_UTILIZATION
      ? WAD - TARGET_UTILIZATION
      : TARGET_UTILIZATION;
  const err = wDivDown(utilization - TARGET_UTILIZATION, errNormFactor);

  const speed = wMulDown(ADJUSTMENT_SPEED, err);
  const elapsed = timestamp - market.lastUpdate;

  const linearAdaptation = speed * elapsed;
  const rateAtTarget = wMulDown(startRateAtTarget, wExp(linearAdaptation));

  if (rateAtTarget < MIN_RATE_AT_TARGET) return MIN_RATE_AT_TARGET;

  if (rateAtTarget > MAX_RATE_AT_TARGET) return MAX_RATE_AT_TARGET;

  return rateAtTarget;
};

export const computeUtilization = (
  totalBorrow: bigint,
  totalSupply: bigint
): bigint => {
  return totalSupply === 0n ? 0n : wDivDown(totalBorrow, totalSupply);
};

export const accrueInterest = (
  lastBlockTimestamp: bigint,
  marketState: MarketState,
  borrowRate: bigint
): MarketState => {
  const elapsed = lastBlockTimestamp - marketState.lastUpdate;
  if (elapsed === 0n) return marketState;

  if (marketState.totalBorrowAssets !== 0n) {
    const interest = wMulDown(
      marketState.totalBorrowAssets,
      wTaylorCompounded(borrowRate, elapsed)
    );
    const marketWithNewTotal = {
      ...marketState,
      totalBorrowAssets: marketState.totalBorrowAssets + interest,
      totalSupplyAssets: marketState.totalSupplyAssets + interest,
    };

    if (marketWithNewTotal.fee !== 0n) {
      const feeAmount = wMulDown(interest, marketWithNewTotal.fee);
      // The fee amount is subtracted from the total supply in this calculation to compensate for the fact
      // that total supply is already increased by the full interest (including the fee amount).
      const feeShares = toSharesDown(
        feeAmount,
        marketWithNewTotal.totalSupplyAssets - feeAmount,
        marketWithNewTotal.totalSupplyShares
      );
      return {
        ...marketWithNewTotal,
        totalSupplyShares: marketWithNewTotal.totalSupplyShares + feeShares,
      };
    }
    return marketWithNewTotal;
  }
  return marketState;
};

export const computeNewUtilization = (
  wantedRate: bigint,
  rateAtTarget: bigint
): bigint => {
  const maxRate = CURVE_STEEPNESS * rateAtTarget;
  const minRate = rateAtTarget / CURVE_STEEPNESS;
  let newUtilization = 0n;

  if (wantedRate >= maxRate) {
    newUtilization = WAD;
  } else if (wantedRate >= rateAtTarget) {
    newUtilization =
      TARGET_UTILIZATION +
      mulDivDown(
        WAD - TARGET_UTILIZATION,
        wantedRate - rateAtTarget,
        maxRate - rateAtTarget
      );
  } else if (wantedRate > minRate) {
    newUtilization = mulDivDown(
      TARGET_UTILIZATION,
      wantedRate - minRate,
      rateAtTarget - minRate
    );
  }
  return newUtilization;
};

export const computeSupplyValue = (
  marketData: MarketChainData,
  wantedAPY: bigint
): InteractionData => {
  const wantedRate = getRateFromAPY(wantedAPY);
  const newUtilization = computeNewUtilization(
    wantedRate,
    marketData.rateAtTarget
  );
  const toSupply =
    newUtilization === 0n
      ? maxUint256
      : wDivDown(marketData.marketState.totalBorrowAssets, newUtilization) -
        marketData.marketState.totalSupplyAssets;
  return { amount: toSupply, newUtilization };
};

export const computeWithdrawValue = (
  marketData: MarketChainData,
  wantedAPY: bigint
): InteractionData => {
  const wantedRate = getRateFromAPY(wantedAPY);
  const newUtilization = computeNewUtilization(
    wantedRate,
    marketData.rateAtTarget
  );
  const toWithdraw =
    newUtilization === 0n
      ? 0n
      : marketData.marketState.totalSupplyAssets -
        wDivDown(marketData.marketState.totalBorrowAssets, newUtilization);
  return { amount: toWithdraw, newUtilization };
};

export const computeBorrowValue = (
  marketData: MarketChainData,
  wantedAPY: bigint
): InteractionData => {
  const wantedRate = getRateFromAPY(wantedAPY);
  const newUtilization = computeNewUtilization(
    wantedRate,
    marketData.rateAtTarget
  );
  const toBorrow =
    wMulDown(marketData.marketState.totalSupplyAssets, newUtilization) -
    marketData.marketState.totalBorrowAssets;
  return { amount: toBorrow, newUtilization };
};

export const getRateFromAPY = (apy: bigint): bigint => {
  const firstTerm = BigInt(apy);
  const secondTerm = wMulDown(firstTerm, firstTerm);
  const thirdTerm = wMulDown(secondTerm, firstTerm);
  const apr = firstTerm - secondTerm / 2n + thirdTerm / 3n;
  return apr / YEAR;
};

export const getReallocationData = (
  marketChainData: MarketChainData,
  strategy: Strategy | undefined
) => {
  if (!strategy || strategy.blacklist) return;
  if (strategy.idleMarket)
    return {
      toSupply: maxUint256,
      toWithdraw: marketChainData.marketState.totalSupplyAssets,
      toBorrow: 0n,
    };
  if (strategy.utilizationTarget) {
    return computeUtilizationReallocationData(
      marketChainData,
      BigInt(strategy.utilizationTarget)
    );
  } else if (strategy.targetBorrowApy) {
    return computeReallocationData(
      marketChainData,
      BigInt(strategy.targetBorrowApy)
    );
  }
  return;
};

const computeReallocationData = (
  marketChainData: MarketChainData,
  targetApy: bigint
) => {
  const lowerThreshold = getPercentsOf(
    targetApy,
    100 - REALLOCATION_DIST_THRESHOLD
  );
  const upperThreshold = getPercentsOf(
    targetApy,
    100 + REALLOCATION_DIST_THRESHOLD
  );

  const reallocationData = {
    toSupply: 0n,
    toWithdraw: 0n,
    toBorrow: 0n,
  };

  if (marketChainData.apys.borrowApy <= lowerThreshold) {
    const toWithdraw = computeWithdrawValue(marketChainData, targetApy).amount;
    const toBorrow = computeBorrowValue(marketChainData, targetApy).amount;

    const availableLiquidity = computeAvailableLiquididty(
      marketChainData.marketState
    );

    reallocationData.toWithdraw =
      toWithdraw < availableLiquidity
        ? toWithdraw
        : getPercentsOf(availableLiquidity, 95);

    reallocationData.toBorrow =
      toBorrow < availableLiquidity
        ? toBorrow
        : getPercentsOf(availableLiquidity, 95);
  }

  if (marketChainData.apys.borrowApy > upperThreshold) {
    reallocationData.toSupply = computeSupplyValue(
      marketChainData,
      targetApy
    ).amount;
  }

  return reallocationData;
};

const computeUtilizationReallocationData = (
  marketChainData: MarketChainData,
  targetUtilization: bigint
) => {
  const marketState = marketChainData.marketState;

  const utilization = computeUtilization(
    marketState.totalBorrowAssets,
    marketState.totalSupplyAssets
  );

  const reallocationData = { toSupply: 0n, toWithdraw: 0n, toBorrow: 0n };
  const distanceToTargetUtilization = wDivDown(
    abs(targetUtilization - utilization),
    targetUtilization
  );
  if (
    distanceToTargetUtilization > percentToWad(REALLOCATION_THRESHOLD_PERCENT)
  ) {
    if (utilization > targetUtilization)
      reallocationData.toSupply =
        wDivDown(marketState.totalBorrowAssets, targetUtilization) -
        marketState.totalSupplyAssets;
    else {
      reallocationData.toWithdraw =
        marketState.totalSupplyAssets -
        wDivDown(marketState.totalBorrowAssets, targetUtilization);

      reallocationData.toBorrow =
        wMulDown(marketState.totalSupplyAssets, targetUtilization) -
        marketState.totalBorrowAssets;
    }
  }

  return reallocationData;
};

export const computeNewBorrowAPY = (
  irm: string,
  newUtilization: bigint,
  rateAtTarget: bigint
) => {
  if (irm !== zeroAddress) {
    let newRate = 0n;
    if (newUtilization > TARGET_UTILIZATION) {
      newRate =
        rateAtTarget +
        mulDivUp(
          3n * rateAtTarget,
          newUtilization - TARGET_UTILIZATION,
          WAD - TARGET_UTILIZATION
        );
    } else {
      newRate =
        mulDivUp(3n * rateAtTarget, newUtilization, 4n * TARGET_UTILIZATION) +
        rateAtTarget / 4n;
    }
    return wTaylorCompounded(newRate, YEAR);
  } else return 0n;
};

export const computeNewSupplyAPY = (
  irm: string,
  newUtilization: bigint,
  rateAtTarget: bigint
) => {
  return wMulDown(
    computeNewBorrowAPY(irm, newUtilization, rateAtTarget),
    newUtilization
  );
};

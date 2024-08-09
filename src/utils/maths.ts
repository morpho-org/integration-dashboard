import "evm-maths";
import { MarketState } from "./types";
import {
  ADJUSTMENT_SPEED,
  LN_2_INT,
  LN_WEI_INT,
  MAX_RATE_AT_TARGET,
  MIN_RATE_AT_TARGET,
  TARGET_UTILIZATION,
  VIRTUAL_ASSETS,
  VIRTUAL_SHARES,
  WAD,
  WEXP_UPPER_BOUND,
  WEXP_UPPER_VALUE,
} from "../config/constants";

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

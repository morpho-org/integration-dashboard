import { Asset, ReallocationLogData } from "./types";
import { formatTokenAmount, formatWAD } from "./utils";

export const formatAllocation = (
  logData: ReallocationLogData,
  asset: Asset
) => {
  const lines = [
    `- ${formatAllocationAssets(logData, asset)} ${logData.marketName}`,
    `   Utilization : ${formatWAD(logData.previousUtilization)} → ${formatWAD(
      logData.newUtilization
    )}`,
    `   Supply APY : ${formatWAD(logData.previousSupplyAPY)} → ${formatWAD(
      logData.newSupplyAPY
    )}`,
    `   Borrow APY : ${formatWAD(logData.previousBorrowAPY)} → ${formatWAD(
      logData.newBorrowAPY
    )}`,
  ];
  return lines;
};

const formatAllocationAssets = (logData: ReallocationLogData, asset: Asset) => {
  const symbol = asset.symbol;
  if (logData.supplyMax)
    return `Supply ${formatTokenAmount(logData.toSupply, asset)} (Max) into`;
  else if (logData.toSupply !== 0n) {
    return `Supply ${formatTokenAmount(
      logData.toSupply,
      asset
    )} ${symbol} into`;
  } else if (logData.withdrawMax)
    return `Withdraw ${formatTokenAmount(
      logData.toWithdraw,
      asset
    )} (All) from`;
  else if (logData.toWithdraw !== 0n) {
    return `Withdraw ${formatTokenAmount(logData.toWithdraw, asset)} from`;
  }
};

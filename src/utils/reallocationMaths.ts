import { formatUnits, maxUint256 } from "viem";
import { REALLOCATION_USD_THRESHOLD } from "../config/constants";
import {
    computeNewBorrowAPY,
    computeNewSupplyAPY,
    computeUtilization,
    getPercentsOf,
    max,
    min
} from "./maths";
import {
    MarketReallocationData,
    MetaMorphoVault,
    Reallocation,
    ReallocationLogData,
    Withdrawal
} from "./types";
import { formatMarketLink, getMarketName, sortWithdrawals } from "./utils";

export const getMarketReallocationData = (
  vault: MetaMorphoVault,
  toReallocate: bigint,
  supplyReallocation: boolean,
  networkId: number
): MarketReallocationData[] => {
  const marketReallocationData: MarketReallocationData[] = [];

  const enabledMarketIds = Object.keys(vault.positions);

  for (const enabledMarketId of enabledMarketIds) {
    const position = vault.positions[enabledMarketId];
    const marketData = position.marketData;

    if (
      !marketData.reallocationData ||
      (marketData.targetApy === undefined && marketData.targetUtilization)
    )
      continue;

    const amountToReachTarget = supplyReallocation
      ? marketData.reallocationData.toWithdraw
      : marketData.reallocationData.toSupply;

    const availableAmount = supplyReallocation
      ? min(marketData.reallocationData.toWithdraw, position.supplyAssets)
      : min(
          marketData.reallocationData.toSupply,
          max(
            vault.positions[enabledMarketId].supplyCap -
              vault.positions[enabledMarketId].supplyAssets,
            0n
          )
        );

    const marketState = marketData.marketState;
    const utilization = computeUtilization(
      marketState.totalBorrowAssets,
      marketState.totalSupplyAssets
    );

    const target = marketData.targetApy
      ? {
          borrowApy: marketData.apys.borrowApy,
          apyTarget: marketData.targetApy,
        }
      : {
          utilization,
          utilizationTarget: marketData.targetUtilization!,
        };

    const flowCap = supplyReallocation
      ? vault.flowCaps[enabledMarketId].maxOut
      : vault.flowCaps[enabledMarketId].maxIn;
    const maxReallocationAmount = min(availableAmount, flowCap);

    const threshold = getPercentsOf(toReallocate, 10);

    const warnings =
      maxReallocationAmount >= threshold
        ? undefined
        : {
            targetTooCloseOrAlreadyCrossed: amountToReachTarget < threshold,
            flowCapTooLow: flowCap < threshold,
            allocationOrCapInsufficient: supplyReallocation
              ? position.supplyAssets < threshold
              : position.supplyCap - position.supplyAssets < threshold,
          };

    marketReallocationData.push({
      id: enabledMarketId,
      link: {
        url: formatMarketLink(enabledMarketId, networkId),
        name: getMarketName(
          marketData.loanAsset.symbol,
          marketData.collateralAsset ? marketData.collateralAsset.symbol : null,
          marketData.marketParams.lltv
        ),
      },
      supplyReallocation,
      maxReallocationAmount,
      supplyAssets: position.supplyAssets,
      amountToReachCap: max(
        vault.positions[enabledMarketId].supplyCap -
          vault.positions[enabledMarketId].supplyAssets,
        0n
      ),
      amountToReachTarget,
      flowCap,
      target,
      warnings,
    });
  }

  return marketReallocationData;
};

export const seekForSupplyReallocation = (
  marketToSupplyIntoId: string,
  vault: MetaMorphoVault,
  filterIdleMarkets: boolean
): Reallocation | undefined => {
  const marketToSupplyInto = vault.positions[marketToSupplyIntoId].marketData;

  const toSupply = computeToSupplyReallocate(
    vault,
    marketToSupplyInto.id,
    maxUint256
  ).toSupply;

  const enabledMarketIds = Object.keys(vault.positions).filter(
    (marketId) =>
      !filterIdleMarkets ||
      vault.positions[marketId].marketData.collateralAsset.address !==
        "0x0000000000000000000000000000000000000000"
  );

  const totalToWithdraw = enabledMarketIds.reduce(
    (total, enabledMarketId) =>
      total +
      computeToWithdrawReallocate(vault, enabledMarketId, maxUint256)
        .toWithdraw,
    0n
  );

  const toReallocate = min(toSupply, totalToWithdraw);
  if (toReallocate === 0n) return;

  const totalUsd =
    +formatUnits(toReallocate, Number(vault.underlyingAsset.decimals)) *
    vault.underlyingAsset.priceUsd;

  const withdrawals: Withdrawal[] = [];
  const withdrawReallocationsLogData: ReallocationLogData[] = [];

  let remainingToWithdraw = toReallocate;

  for (const id of enabledMarketIds) {
    if (id === marketToSupplyInto.id) continue;

    const marketData = vault.positions[id].marketData;
    const reallocationData = marketData.reallocationData;
    const marketState = marketData.marketState;
    const previousUtilization = computeUtilization(
      marketState.totalBorrowAssets,
      marketState.totalSupplyAssets
    );

    let toWithdraw = 0n;

    if (
      reallocationData &&
      reallocationData.toWithdraw > 0n &&
      remainingToWithdraw > 0n
    ) {
      const withdrawData = computeToWithdrawReallocate(
        vault,
        id,
        remainingToWithdraw
      );

      toWithdraw = withdrawData.toWithdraw;
      remainingToWithdraw = withdrawData.remainingToWithdraw;

      if (toWithdraw > 0n) {
        const newUtilization = computeUtilization(
          marketState.totalBorrowAssets,
          marketState.totalSupplyAssets - toWithdraw
        );
        const withdrawMax = vault.positions[id].supplyAssets === toWithdraw;
        withdrawals.push({
          marketParams: marketData.marketParams,
          amount: toWithdraw,
        });
        withdrawReallocationsLogData.push({
          marketId: marketData.id,
          marketName: marketData.name,
          supplyMax: false,
          withdrawMax: withdrawMax,
          toSupply: 0n,
          toWithdraw: toWithdraw,
          previousUtilization: previousUtilization,
          newUtilization: newUtilization,
          previousSupplyAPY: marketData.apys.supplyApy,
          newSupplyAPY: computeNewSupplyAPY(
            marketData.marketParams.irm,
            newUtilization,
            marketData.rateAtTarget
          ),
          previousBorrowAPY: marketData.apys.borrowApy,
          newBorrowAPY: computeNewBorrowAPY(
            marketData.marketParams.irm,
            newUtilization,
            marketData.rateAtTarget
          ),
        });
      }
    }
  }

  if (withdrawals.length !== 0) {
    const supplyMarketData = vault.positions[marketToSupplyInto.id].marketData;
    const supplyMarketPreviousUtilization = computeUtilization(
      supplyMarketData.marketState.totalBorrowAssets,
      supplyMarketData.marketState.totalSupplyAssets
    );
    const supplyMarketNewUtilization = computeUtilization(
      supplyMarketData.marketState.totalBorrowAssets,
      supplyMarketData.marketState.totalSupplyAssets + toReallocate
    );
    const supplyReallocationLogData: ReallocationLogData = {
      marketId: supplyMarketData.id,
      marketName: supplyMarketData.name,
      supplyMax: true,
      withdrawMax: false,
      toSupply: toReallocate,
      toWithdraw: 0n,
      previousUtilization: supplyMarketPreviousUtilization,
      newUtilization: supplyMarketNewUtilization,
      previousSupplyAPY: supplyMarketData.apys.supplyApy,
      newSupplyAPY: computeNewSupplyAPY(
        supplyMarketData.marketParams.irm,
        supplyMarketNewUtilization,
        supplyMarketData.rateAtTarget
      ),
      previousBorrowAPY: supplyMarketData.apys.borrowApy,
      newBorrowAPY: computeNewBorrowAPY(
        supplyMarketData.marketParams.irm,
        supplyMarketNewUtilization,
        supplyMarketData.rateAtTarget
      ),
    };

    return {
      withdrawals: sortWithdrawals(withdrawals),
      supplyMarketParams: supplyMarketData.marketParams,
      logData: [...withdrawReallocationsLogData, supplyReallocationLogData],
      amountReallocated: toReallocate,
      newState: {
        apys: {
          supplyApy: supplyReallocationLogData.newSupplyAPY,
          borrowApy: supplyReallocationLogData.newBorrowAPY,
        },
        utilization: supplyReallocationLogData.newUtilization,
      },
      totalUsd,
    };
  }
};

export const seekForWithdrawReallocation = (
  marketToWithdrawFromId: string,
  vault: MetaMorphoVault,
  filterIdleMarkets: boolean
): Reallocation | undefined => {
  const marketToWithdrawFrom =
    vault.positions[marketToWithdrawFromId].marketData;

  const toWithdraw = computeToWithdrawReallocate(
    vault,
    marketToWithdrawFrom.id,
    maxUint256
  ).toWithdraw;

  let supplyMarket = { id: "", amount: 0n };
  const enabledMarketIds = Object.keys(vault.positions).filter(
    (marketId) =>
      !filterIdleMarkets ||
      vault.positions[marketId].marketData.collateralAsset.address !==
        "0x0000000000000000000000000000000000000000"
  );

  const amountsToSupply = enabledMarketIds.map(
    (id) => computeToSupplyReallocate(vault, id, maxUint256).toSupply,
    0n
  );

  for (let i = 0; i < enabledMarketIds.length; i++) {
    if (amountsToSupply[i] > supplyMarket.amount)
      supplyMarket = { id: enabledMarketIds[i], amount: amountsToSupply[i] };
  }

  const toReallocate = min(supplyMarket.amount, toWithdraw);
  if (toReallocate === 0n) return;

  const totalUsd =
    +formatUnits(toReallocate, Number(vault.underlyingAsset.decimals)) *
    vault.underlyingAsset.priceUsd;

  const supplyMarketData = vault.positions[supplyMarket.id].marketData;

  const withdrawal: Withdrawal[] = [
    {
      marketParams: marketToWithdrawFrom.marketParams,
      amount: toReallocate,
    },
  ];
  const withdrawMax =
    vault.positions[marketToWithdrawFrom.id].supplyAssets === toWithdraw;
  const previousWithdrawMarketUtilization = computeUtilization(
    marketToWithdrawFrom.marketState.totalBorrowAssets,
    marketToWithdrawFrom.marketState.totalSupplyAssets
  );
  const newWithdrawMarketUtilization = computeUtilization(
    marketToWithdrawFrom.marketState.totalBorrowAssets,
    marketToWithdrawFrom.marketState.totalSupplyAssets - toWithdraw
  );
  const withdrawReallocationsLogData: ReallocationLogData[] = [
    {
      marketId: marketToWithdrawFrom.id,
      marketName: marketToWithdrawFrom.name,
      supplyMax: false,
      withdrawMax: withdrawMax,
      toSupply: 0n,
      toWithdraw: toWithdraw,
      previousUtilization: previousWithdrawMarketUtilization,
      newUtilization: newWithdrawMarketUtilization,
      previousSupplyAPY: marketToWithdrawFrom.apys.supplyApy,
      newSupplyAPY: computeNewSupplyAPY(
        marketToWithdrawFrom.marketParams.irm,
        newWithdrawMarketUtilization,
        marketToWithdrawFrom.rateAtTarget
      ),
      previousBorrowAPY: marketToWithdrawFrom.apys.borrowApy,
      newBorrowAPY: computeNewBorrowAPY(
        marketToWithdrawFrom.marketParams.irm,
        newWithdrawMarketUtilization,
        marketToWithdrawFrom.rateAtTarget
      ),
    },
  ];

  const supplyMarketPreviousUtilization = computeUtilization(
    supplyMarketData.marketState.totalBorrowAssets,
    supplyMarketData.marketState.totalSupplyAssets
  );
  const supplyMarketNewUtilization = computeUtilization(
    supplyMarketData.marketState.totalBorrowAssets,
    supplyMarketData.marketState.totalSupplyAssets + toReallocate
  );
  const supplyReallocationLogData: ReallocationLogData = {
    marketId: supplyMarketData.id,
    marketName: supplyMarketData.name,
    supplyMax: true,
    withdrawMax: false,
    toSupply: toReallocate,
    toWithdraw: 0n,
    previousUtilization: supplyMarketPreviousUtilization,
    newUtilization: supplyMarketNewUtilization,
    previousSupplyAPY: supplyMarketData.apys.supplyApy,
    newSupplyAPY: computeNewSupplyAPY(
      supplyMarketData.marketParams.irm,
      supplyMarketNewUtilization,
      supplyMarketData.rateAtTarget
    ),
    previousBorrowAPY: supplyMarketData.apys.borrowApy,
    newBorrowAPY: computeNewBorrowAPY(
      supplyMarketData.marketParams.irm,
      supplyMarketNewUtilization,
      supplyMarketData.rateAtTarget
    ),
  };

  return {
    withdrawals: withdrawal,
    supplyMarketParams: supplyMarketData.marketParams,
    logData: [...withdrawReallocationsLogData, supplyReallocationLogData],
    amountReallocated: toReallocate,
    newState: {
      apys: {
        supplyApy: withdrawReallocationsLogData[0].newSupplyAPY,
        borrowApy: withdrawReallocationsLogData[0].newBorrowAPY,
      },
      utilization: withdrawReallocationsLogData[0].newUtilization,
    },
    totalUsd,
  };
};

const computeToSupplyReallocate = (
  vault: MetaMorphoVault,
  enabledMarketId: string,
  remainingToSupply: bigint
) => {
  const position = vault.positions[enabledMarketId];

  if (!position.marketData.reallocationData)
    return { toSupply: 0n, remainingToSupply };

  let toSupply = min(
    position.marketData.reallocationData.toSupply,
    max(
      vault.positions[enabledMarketId].supplyCap -
        vault.positions[enabledMarketId].supplyAssets,
      0n
    )
  );
  toSupply = min(toSupply, remainingToSupply);
  toSupply = min(toSupply, vault.flowCaps[enabledMarketId].maxIn);

  if (toSupply > 0n) {
    let usdValue =
      Number(formatUnits(toSupply, Number(vault.underlyingAsset.decimals))) *
      vault.underlyingAsset.priceUsd;
    if (usdValue > REALLOCATION_USD_THRESHOLD)
      return { toSupply, remainingToSupply: remainingToSupply - toSupply };
  }
  return { toSupply: 0n, remainingToSupply };
};

const computeToWithdrawReallocate = (
  vault: MetaMorphoVault,
  enabledMarketId: string,
  remainingToWithdraw: bigint
) => {
  const position = vault.positions[enabledMarketId];

  if (!position.marketData.reallocationData)
    return { toWithdraw: 0n, remainingToWithdraw };

  let toWithdraw = min(
    position.marketData.reallocationData.toWithdraw,
    position.supplyAssets
  );
  toWithdraw = min(toWithdraw, remainingToWithdraw);
  toWithdraw = min(toWithdraw, vault.flowCaps[enabledMarketId].maxOut);

  if (toWithdraw > 0n) {
    let usdValue =
      Number(formatUnits(toWithdraw, Number(vault.underlyingAsset.decimals))) *
      vault.underlyingAsset.priceUsd;
    if (usdValue > REALLOCATION_USD_THRESHOLD)
      return {
        toWithdraw,
        remainingToWithdraw: remainingToWithdraw - toWithdraw,
      };
  }
  return { toWithdraw: 0n, remainingToWithdraw };
};

import { MathLib, type Market, type MarketId } from "@morpho-org/blue-sdk";
import { InsufficientSharedLiquidityError } from "@morpho-org/morpho-sdk";
import type { VaultV2BlueReallocation } from "@morpho-org/morpho-sdk";
import type { VaultV2BlueReallocationData } from "@morpho-org/morpho-sdk/entities";

export interface SourceImpact {
  key: string;
  vault: `0x${string}`;
  source:
    | { type: "market"; marketId: MarketId; adapter: `0x${string}` }
    | { type: "idle" };
  liquidityBefore?: bigint;
  liquidityAfter?: bigint;
  assets: bigint;
  penalty: bigint;
  penaltyAssets: bigint;
}

export type BorrowPlan =
  | {
      status: "no-reallocation";
      marketBefore: Market;
      marketAfterBorrow: Market;
    }
  | {
      status: "reallocations";
      reallocations: readonly VaultV2BlueReallocation[];
      marketBefore: Market;
      marketAfterReallocation: Market;
      marketAfterBorrow: Market;
      sourceImpacts: readonly SourceImpact[];
    }
  | {
      status: "insufficient-liquidity";
      requested: bigint;
      available: bigint;
      message: string;
    }
  | { status: "error"; message: string };

/**
 * Return local, shared, and total liquidity at one timestamp.
 */
export function getLiquidityBreakdown(
  data: VaultV2BlueReallocationData,
  marketId: MarketId,
  timestamp: bigint,
) {
  const local = data.getMarket(marketId).accrueInterest(timestamp).liquidity;
  const shared = data.getPublicReallocationLiquidity(marketId, {
    timestamp,
    maxWithdrawalUtilization: MathLib.WAD,
  });
  return { local, shared, total: local + shared };
}

/**
 * Build a borrow simulation and classify liquidity or planner failures.
 */
export function planBorrow(
  data: VaultV2BlueReallocationData,
  marketId: MarketId,
  amount: bigint,
  timestamp: bigint,
): BorrowPlan {
  let available = 0n;
  try {
    const marketBefore = data.getMarket(marketId).accrueInterest(timestamp);
    if (amount === 0n)
      return {
        status: "no-reallocation",
        marketBefore,
        marketAfterBorrow: marketBefore,
      };

    const breakdown = getLiquidityBreakdown(data, marketId, timestamp);
    available = breakdown.total;
    if (amount > available)
      return {
        status: "insufficient-liquidity",
        requested: amount,
        available,
        message: `Requested ${amount} assets, but only ${available} are available.`,
      };

    const result = data.computeVaultV2BlueReallocations(marketId, {
      timestamp,
      operation: { type: "borrow", amount },
    });
    const marketAfterReallocation = result.data
      .getMarket(marketId)
      .accrueInterest(timestamp);
    const marketAfterBorrow = marketAfterReallocation.borrow(
      amount,
      0n,
      timestamp,
    ).market;

    if (result.reallocations.length === 0)
      return { status: "no-reallocation", marketBefore, marketAfterBorrow };

    const sourceImpacts = result.reallocations.map((reallocation) => {
      if (reallocation.from.type === "idle")
        return {
          key: reallocationKey(reallocation),
          vault: reallocation.vault,
          source: { type: "idle" as const },
          assets: reallocation.assets,
          penalty: reallocation.penalty,
          penaltyAssets: MathLib.mulDivUp(
            reallocation.assets,
            reallocation.penalty,
            MathLib.WAD,
          ),
        };

      const sourceMarketId = reallocation.from.marketParams.id;
      return {
        key: reallocationKey(reallocation),
        vault: reallocation.vault,
        source: {
          type: "market" as const,
          marketId: sourceMarketId,
          adapter: reallocation.from.adapter,
        },
        liquidityBefore: data
          .getMarket(sourceMarketId)
          .accrueInterest(timestamp).liquidity,
        liquidityAfter: result.data
          .getMarket(sourceMarketId)
          .accrueInterest(timestamp).liquidity,
        assets: reallocation.assets,
        penalty: reallocation.penalty,
        penaltyAssets: MathLib.mulDivUp(
          reallocation.assets,
          reallocation.penalty,
          MathLib.WAD,
        ),
      };
    });

    return {
      status: "reallocations",
      reallocations: result.reallocations,
      marketBefore,
      marketAfterReallocation,
      marketAfterBorrow,
      sourceImpacts,
      };
  } catch (error) {
    if (error instanceof InsufficientSharedLiquidityError)
      return {
        status: "insufficient-liquidity",
        requested: amount,
        available,
        message: error.message,
      };
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create a stable lowercased key for a planned source-to-target allocation.
 */
export function reallocationKey(reallocation: VaultV2BlueReallocation) {
  const source =
    reallocation.from.type === "market"
      ? `${reallocation.from.adapter}-${reallocation.from.marketParams.id}`
      : "idle";
  return `${reallocation.vault}-${reallocation.from.type}-${source}-${reallocation.to.adapter}`.toLowerCase();
}

/**
 * Apply per-entry edits without mutating the planned allocation list.
 */
export function applyEditedAmounts(
  reallocations: readonly VaultV2BlueReallocation[],
  edits: Readonly<Record<string, bigint>>,
): VaultV2BlueReallocation[] {
  return reallocations.flatMap((reallocation) => {
    const edited = edits[reallocationKey(reallocation)];
    const assets =
      edited === undefined
        ? reallocation.assets
        : edited < 0n
          ? 0n
          : edited > reallocation.assets
            ? reallocation.assets
            : edited;
    return assets === 0n ? [] : [{ ...reallocation, assets }];
  });
}

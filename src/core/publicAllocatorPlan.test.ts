import { MathLib, type Market, type MarketId } from "@morpho-org/blue-sdk";
import {
  InsufficientSharedLiquidityError,
  type VaultV2BlueReallocation,
} from "@morpho-org/morpho-sdk";
import type { MarketParams } from "@morpho-org/morpho-sdk/blue/entities";
import type { VaultV2BlueReallocationData } from "@morpho-org/morpho-sdk/entities";
import { describe, expect, test, vi } from "vitest";
import {
  applyEditedAmounts,
  getLiquidityBreakdown,
  planBorrow,
  reallocationKey,
} from "./publicAllocatorPlan";

const vault = "0x0000000000000000000000000000000000000001";
const sourceAdapter = "0x0000000000000000000000000000000000000002";
const targetAdapter = "0x0000000000000000000000000000000000000003";
const sourceMarketId = `0x${"a".repeat(64)}` as MarketId;
const marketParams = {
  loanToken: "0x0000000000000000000000000000000000000004",
  collateralToken: "0x0000000000000000000000000000000000000005",
  oracle: "0x0000000000000000000000000000000000000006",
  irm: "0x0000000000000000000000000000000000000007",
  lltv: 800_000_000_000_000_000n,
  liquidationIncentiveFactor: 1_000_000_000_000_000_000n,
  id: sourceMarketId,
} as MarketParams;
const market = {
  liquidity: 100n,
  accrueInterest: vi.fn(function (this: Market) {
    return this;
  }),
} as unknown as Market;

function makeData(
  sharedLiquidity = 50n,
  computeVaultV2BlueReallocations = vi.fn(),
) {
  return {
    getMarket: vi.fn(() => market),
    getPublicReallocationLiquidity: vi.fn(() => sharedLiquidity),
    computeVaultV2BlueReallocations,
  } as unknown as VaultV2BlueReallocationData;
}

function makeReallocation(
  overrides: Partial<VaultV2BlueReallocation> = {},
): VaultV2BlueReallocation {
  return {
    vault,
    from: {
      type: "market",
      adapter: sourceAdapter,
      marketParams,
    },
    to: { adapter: targetAdapter },
    assets: 100n,
    penalty: 0n,
    ...overrides,
  } as VaultV2BlueReallocation;
}

describe("reallocationKey", () => {
  test("keys a market allocation by its vault, source, and adapters", () => {
    expect(reallocationKey(makeReallocation())).toBe(
      `${vault}-${"market"}-${sourceAdapter}-${sourceMarketId}-${targetAdapter}`,
    );
  });

  test("keys an idle allocation", () => {
    expect(
      reallocationKey(makeReallocation({ from: { type: "idle" } })),
    ).toBe(`${vault}-idle-idle-${targetAdapter}`);
  });
});

describe("applyEditedAmounts", () => {
  test("clamps edits, drops zero entries, and does not mutate the plan", () => {
    const planned = [
      makeReallocation(),
      makeReallocation({
        vault: "0x0000000000000000000000000000000000000008",
        assets: 50n,
      }),
      makeReallocation({
        vault: "0x0000000000000000000000000000000000000009",
        assets: 25n,
      }),
    ];
    const before = planned.map((entry) => entry.assets);
    const edits = {
      [reallocationKey(planned[0])]: 200n,
      [reallocationKey(planned[1])]: 0n,
      [reallocationKey(planned[2])]: -1n,
    };
    const edited = applyEditedAmounts(planned, edits);

    expect(edited.map((entry) => entry.assets)).toEqual([100n]);
    expect(planned.map((entry) => entry.assets)).toEqual(before);
    expect(edited[0]).not.toBe(planned[0]);
  });

  test("preserves the planned amount when an edit is absent", () => {
    const planned = [makeReallocation()];
    expect(applyEditedAmounts(planned, {})[0].assets).toBe(100n);
  });
});

describe("planBorrow", () => {
  test("uses local plus shared liquidity at the requested timestamp", () => {
    const timestamp = 1_000n;
    const data = makeData(50n);

    expect(getLiquidityBreakdown(data, sourceMarketId, timestamp)).toEqual({
      local: 100n,
      shared: 50n,
      total: 150n,
    });
    expect(data.getPublicReallocationLiquidity).toHaveBeenCalledWith(
      sourceMarketId,
      {
        timestamp,
        maxWithdrawalUtilization: MathLib.WAD,
      },
    );
  });

  test("returns no-reallocation for a zero amount", () => {
    const data = makeData();

    expect(planBorrow(data, sourceMarketId, 0n, 1_000n).status).toBe(
      "no-reallocation",
    );
    expect(data.computeVaultV2BlueReallocations).not.toHaveBeenCalled();
  });

  test("classifies amounts over total liquidity as insufficient", () => {
    expect(planBorrow(makeData(50n), sourceMarketId, 151n, 1_000n)).toMatchObject(
      {
        status: "insufficient-liquidity",
        requested: 151n,
        available: 150n,
      },
    );
  });

  test("keeps allocator insufficiency distinct from generic errors", () => {
    const unavailable = makeData(
      50n,
      vi.fn(() => {
        throw new InsufficientSharedLiquidityError({
          marketId: sourceMarketId,
          shortfall: 1n,
          available: 0n,
        });
      }),
    );
    const failed = makeData(
      50n,
      vi.fn(() => {
        throw new Error("planner failed");
      }),
    );

    expect(planBorrow(unavailable, sourceMarketId, 120n, 1_000n)).toMatchObject({
      status: "insufficient-liquidity",
      available: 150n,
    });
    expect(planBorrow(failed, sourceMarketId, 120n, 1_000n)).toEqual({
      status: "error",
      message: "planner failed",
    });
  });
});

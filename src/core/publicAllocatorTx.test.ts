import { MathLib } from "@morpho-org/blue-sdk";
import type { VaultV2BlueReallocation } from "@morpho-org/morpho-sdk";
import type { MarketParams } from "@morpho-org/morpho-sdk/blue/entities";
import { vaultV2BluePublicAllocatorAbi } from "@morpho-org/morpho-sdk/abis";
import { getChainAddresses as getMorphoChainAddresses } from "@morpho-org/morpho-sdk/addresses";
import {
  decodeFunctionData,
  maxUint128,
  maxUint64,
  toFunctionSelector,
  type AbiFunction,
} from "viem";
import { describe, expect, test } from "vitest";
import v1PublicAllocatorAbi from "../abis/publicAllocatorAbi.json";
import {
  buildDirectAllocationTx,
  DirectAllocationError,
  getPenaltyAssets,
} from "./publicAllocatorTx";

const address = (suffix: string) =>
  `0x${suffix.padStart(40, "0")}` as `0x${string}`;
const loanToken = address("1");
const collateralToken = address("2");
const oracle = address("3");
const irm = address("4");
const vault = address("5");
const sourceAdapter = address("6");
const targetAdapter = address("7");
const marketParams = {
  loanToken,
  collateralToken,
  oracle,
  irm,
  lltv: 800_000_000_000_000_000n,
  liquidationIncentiveFactor: 1_000_000_000_000_000_000n,
  id: `0x${"a".repeat(64)}`,
} as MarketParams;
const targetMarketParams = {
  ...marketParams,
  id: `0x${"b".repeat(64)}`,
} as MarketParams;

function marketReallocation(
  overrides: Partial<VaultV2BlueReallocation> = {},
): VaultV2BlueReallocation {
  return {
    vault,
    from: { type: "market", adapter: sourceAdapter, marketParams },
    to: { adapter: targetAdapter },
    assets: 1_000_001n,
    penalty: 100_000_000_000_000n,
    ...overrides,
  } as VaultV2BlueReallocation;
}

describe("buildDirectAllocationTx", () => {
  test("encodes a market reallocation with zero native value", () => {
    const built = buildDirectAllocationTx(8453, targetMarketParams, [
      marketReallocation(),
    ]);
    const decoded = decodeFunctionData({
      abi: vaultV2BluePublicAllocatorAbi,
      data: built.tx.data,
    });

    expect(decoded.functionName).toBe("reallocate");
    expect(decoded.args).toEqual([
      vault,
      sourceAdapter,
      {
        loanToken,
        collateralToken,
        oracle,
        irm,
        lltv: marketParams.lltv,
      },
      targetAdapter,
      {
        loanToken,
        collateralToken,
        oracle,
        irm,
        lltv: targetMarketParams.lltv,
      },
      1_000_001n,
      100_000_000_000_000n,
    ]);
    expect(built.tx.value).toBe(0n);
    expect(built.penaltyAssets).toBe(101n);
    expect(built.allocator).toBe(
      getMorphoChainAddresses(8453).vaultV2BluePublicAllocator,
    );
  });

  test("encodes idle allocation and rounds penalties up", () => {
    const idle = marketReallocation({
      from: { type: "idle" },
      assets: 1_000_001n,
    });
    const built = buildDirectAllocationTx(8453, targetMarketParams, [idle]);
    const decoded = decodeFunctionData({
      abi: vaultV2BluePublicAllocatorAbi,
      data: built.tx.data,
    });

    expect(decoded.functionName).toBe("allocateFromIdle");
    expect(decoded.args).toEqual([
      vault,
      targetAdapter,
      {
        loanToken,
        collateralToken,
        oracle,
        irm,
        lltv: targetMarketParams.lltv,
      },
      1_000_001n,
      100_000_000_000_000n,
    ]);
    expect(getPenaltyAssets(idle)).toBe(101n);
    expect(built.penaltyAssets).toBe(101n);
    expect(built.tx.value).toBe(0n);
  });

  test("multicalls multiple allocations and aggregates penalty assets", () => {
    const first = marketReallocation();
    const second = marketReallocation({
      from: { type: "idle" },
      assets: 10n,
      penalty: MathLib.WAD,
    });
    const built = buildDirectAllocationTx(8453, targetMarketParams, [
      first,
      second,
    ]);
    const multicall = [
      {
        type: "function",
        name: "multicall",
        inputs: [{ name: "data", type: "bytes[]" }],
        outputs: [],
        stateMutability: "nonpayable",
      },
    ] as const;
    const decoded = decodeFunctionData({
      abi: multicall,
      data: built.tx.data,
    });
    const innerCalls = decoded.args[0];

    expect(decoded.functionName).toBe("multicall");
    expect(
      decodeFunctionData({
        abi: vaultV2BluePublicAllocatorAbi,
        data: innerCalls[0],
      }).functionName,
    ).toBe("reallocate");
    expect(
      decodeFunctionData({
        abi: vaultV2BluePublicAllocatorAbi,
        data: innerCalls[1],
      }).functionName,
    ).toBe("allocateFromIdle");
    expect(built.penaltyAssets).toBe(111n);
    expect(built.tx.value).toBe(0n);
  });

  test("rejects invalid calls and unsupported chains", () => {
    expect(() =>
      buildDirectAllocationTx(8453, targetMarketParams, []),
    ).toThrow(DirectAllocationError);
    expect(() =>
      buildDirectAllocationTx(123456, targetMarketParams, [
        marketReallocation(),
      ]),
    ).toThrow(/does not support/);
    expect(() =>
      buildDirectAllocationTx(8453, targetMarketParams, [
        marketReallocation({ assets: 0n }),
      ]),
    ).toThrow(/assets/);
    expect(() =>
      buildDirectAllocationTx(8453, targetMarketParams, [
        marketReallocation({ assets: maxUint128 + 1n }),
      ]),
    ).toThrow(/assets/);
    expect(() =>
      buildDirectAllocationTx(8453, targetMarketParams, [
        marketReallocation({ penalty: -1n }),
      ]),
    ).toThrow(/Penalty/);
    expect(() =>
      buildDirectAllocationTx(8453, targetMarketParams, [
        marketReallocation({ penalty: maxUint64 + 1n }),
      ]),
    ).toThrow(/Penalty/);
    expect(() =>
      buildDirectAllocationTx(8453, targetMarketParams, [
        marketReallocation({
          from: {
            type: "market",
            adapter: sourceAdapter,
            marketParams: {
              ...marketParams,
              loanToken: address("8"),
            } as MarketParams,
          },
        }),
      ]),
    ).toThrow(/loan tokens must match/);
  });

  test("does not use the V1 reallocateTo selector", () => {
    const v1ReallocateTo = v1PublicAllocatorAbi.find(
      (item) => item.type === "function" && item.name === "reallocateTo",
    ) as AbiFunction;
    const v1Selector = toFunctionSelector(v1ReallocateTo);
    const built = buildDirectAllocationTx(8453, targetMarketParams, [
      marketReallocation(),
    ]);

    expect(built.tx.data.slice(0, 10)).not.toBe(v1Selector);
    expect(
      decodeFunctionData({
        abi: vaultV2BluePublicAllocatorAbi,
        data: built.tx.data,
      }).functionName,
    ).toBe("reallocate");
  });
});

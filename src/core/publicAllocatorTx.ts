import { MathLib } from "@morpho-org/blue-sdk";
import type { VaultV2BlueReallocation } from "@morpho-org/morpho-sdk";
import {
  type Address,
  type Hex,
  encodeFunctionData,
  maxUint128,
  maxUint64,
} from "viem";
import { getChainAddresses as getMorphoChainAddresses } from "@morpho-org/morpho-sdk/addresses";
import { vaultV2BluePublicAllocatorAbi } from "@morpho-org/morpho-sdk/abis";
import type { MarketParams } from "@morpho-org/morpho-sdk/blue/entities";

const WAD = MathLib.WAD;

const multicallAbi = [
  {
    type: "function",
    name: "multicall",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export class DirectAllocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirectAllocationError";
  }
}

type MarketParamsTuple = {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
};

function toMarketParamsTuple(params: MarketParams): MarketParamsTuple {
  return {
    loanToken: params.loanToken,
    collateralToken: params.collateralToken,
    oracle: params.oracle,
    irm: params.irm,
    lltv: params.lltv,
  };
}

/**
 * Calculate loan-token penalty assets with the allocator's round-up rule.
 */
export function getPenaltyAssets(reallocation: VaultV2BlueReallocation) {
  return MathLib.mulDivUp(
    reallocation.assets,
    reallocation.penalty,
    WAD,
  );
}

/**
 * Encode direct BluePublicAllocator calls for a V2 reallocation plan.
 */
export function buildDirectAllocationTx(
  chainId: number,
  targetMarketParams: MarketParams,
  reallocations: readonly VaultV2BlueReallocation[],
): {
  allocator: Address;
  loanToken: Address;
  penaltyAssets: bigint;
  tx: { to: Address; data: Hex; value: 0n };
} {
  if (reallocations.length === 0)
    throw new DirectAllocationError(
      "No reallocations to send. Plan at least one allocation first.",
    );

  let allocator: Address;
  try {
    allocator =
      getMorphoChainAddresses(chainId).vaultV2BluePublicAllocator as Address;
  } catch {
    throw new DirectAllocationError(
      `Chain ${chainId} does not support the V2 public allocator.`,
    );
  }
  if (!allocator)
    throw new DirectAllocationError(
      `Chain ${chainId} does not support the V2 public allocator.`,
    );

  const targetLoanToken = targetMarketParams.loanToken.toLowerCase();
  const calls = reallocations.map((reallocation) => {
    if (reallocation.assets <= 0n || reallocation.assets > maxUint128)
      throw new DirectAllocationError(
        `Allocation assets must be between 1 and ${maxUint128}.`,
      );
    if (reallocation.penalty < 0n || reallocation.penalty > maxUint64)
      throw new DirectAllocationError(
        `Penalty must be between 0 and ${maxUint64}.`,
      );
    if (
      reallocation.from.type === "market" &&
      reallocation.from.marketParams.loanToken.toLowerCase() !== targetLoanToken
    )
      throw new DirectAllocationError(
        "Source and target loan tokens must match.",
      );

    const targetParams = toMarketParamsTuple(targetMarketParams);
    if (reallocation.from.type === "idle")
      return encodeFunctionData({
        abi: vaultV2BluePublicAllocatorAbi,
        functionName: "allocateFromIdle",
        args: [
          reallocation.vault,
          reallocation.to.adapter,
          targetParams,
          reallocation.assets,
          reallocation.penalty,
        ],
      });

    return encodeFunctionData({
      abi: vaultV2BluePublicAllocatorAbi,
      functionName: "reallocate",
      args: [
        reallocation.vault,
        reallocation.from.adapter,
        toMarketParamsTuple(reallocation.from.marketParams),
        reallocation.to.adapter,
        targetParams,
        reallocation.assets,
        reallocation.penalty,
      ],
    });
  });

  const data =
    calls.length === 1
      ? calls[0]
      : encodeFunctionData({
          abi: multicallAbi,
          functionName: "multicall",
          args: [calls],
        });
  const penaltyAssets = reallocations.reduce(
    (total, reallocation) => total + getPenaltyAssets(reallocation),
    0n,
  );

  return {
    allocator,
    loanToken: targetMarketParams.loanToken,
    penaltyAssets,
    tx: { to: allocator, data, value: 0n },
  };
}

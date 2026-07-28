import { MarketId, MarketParams } from "@morpho-org/blue-sdk";
import { BundlerAction, type Action } from "@morpho-org/morpho-sdk/bundler";
import { Address } from "viem";

const WITHDRAWAL_SAFETY_NUMERATOR = 999n;
const WITHDRAWAL_SAFETY_DENOMINATOR = 1000n;

export type PublicAllocatorWithdrawalInput = {
  marketId: MarketId;
  marketParams: MarketParams;
  amount: bigint;
};

export type WithdrawalsPerVault = {
  [vaultAddress: string]: PublicAllocatorWithdrawalInput[];
};

export type PublicAllocatorFeeResolver = (vault: Address) => bigint;

export function buildPublicAllocatorReallocationActions(
  withdrawalsPerVault: WithdrawalsPerVault,
  supplyMarketParams: MarketParams,
  getVaultFee: PublicAllocatorFeeResolver
): Action[] {
  return Object.entries(withdrawalsPerVault)
    .filter(([, withdrawals]) =>
      withdrawals.some((withdrawal) => withdrawal.amount > 0n)
    )
    .map(([vaultAddress, withdrawals]) => {
      const reducedWithdrawals = [...withdrawals]
        .filter((withdrawal) => withdrawal.amount > 0n)
        .sort((a, b) => (a.marketId > b.marketId ? 1 : -1))
        .map((withdrawal) => ({
          marketParams: withdrawal.marketParams,
          amount:
            (withdrawal.amount * WITHDRAWAL_SAFETY_NUMERATOR) /
            WITHDRAWAL_SAFETY_DENOMINATOR,
        }));

      return {
        type: "reallocateTo",
        args: [
          vaultAddress as Address,
          getVaultFee(vaultAddress as Address),
          reducedWithdrawals,
          supplyMarketParams,
          false,
        ],
      } satisfies Action;
    });
}

export function encodePublicAllocatorReallocationBundle(
  networkId: number,
  withdrawalsPerVault: WithdrawalsPerVault,
  supplyMarketParams: MarketParams,
  getVaultFee: PublicAllocatorFeeResolver
) {
  const actions = buildPublicAllocatorReallocationActions(
    withdrawalsPerVault,
    supplyMarketParams,
    getVaultFee
  );

  if (actions.length === 0) {
    throw new Error("No reallocation actions to execute");
  }

  return BundlerAction.encodeBundle(networkId, actions);
}

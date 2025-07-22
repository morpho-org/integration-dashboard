import {
  getChainAddresses,
  MarketId,
  MarketParams,
} from "@morpho-org/blue-sdk";
import { BundlerAction } from "@morpho-org/morpho-blue-bundlers/pkg";
import { BaseBundlerV2__factory } from "@morpho-org/morpho-blue-bundlers/types";
import { useState } from "react";
import { parseEther } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { WithdrawalDetails } from "../core/publicAllocator";

type TransactionSenderV2Props = {
  networkId: number;
  marketId: MarketId;
  withdrawalsPerVault: { [vaultAddress: string]: WithdrawalDetails[] };
};

export default function TransactionSenderV2({
  networkId,
  marketId,
  withdrawalsPerVault,
}: TransactionSenderV2Props) {
  const [isTransactionSent, setIsTransactionSent] = useState(false);
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);

  const {
    isLoading: isTransactionPending,
    isSuccess: isTransactionSuccessful,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleSendTransaction = async (event: React.MouseEvent) => {
    event.stopPropagation();

    try {
      const config = getChainAddresses(networkId);
      if (!config) throw new Error(`Unsupported chain ID: ${networkId}`);

      const filteredVaults = Object.entries(withdrawalsPerVault)
        .filter(([, withdrawals]) => withdrawals.some((w) => w.amount > 0n))
        .map(([vaultAddress]) => vaultAddress);

      // Create multicall actions
      const multicallActions = filteredVaults.map((vaultAddress) => {
        const vaultWithdrawals = withdrawalsPerVault[vaultAddress];
        // Sort withdrawals within each vault
        vaultWithdrawals.sort((a, b) => (a.marketId > b.marketId ? 1 : -1));

        // Create a copy of withdrawals with reduced amounts (0.1% less)
        const reducedWithdrawals = vaultWithdrawals.map((withdrawal) => {
          if (withdrawal.amount > 0n) {
            // Reduce by 0.1% (multiply by 999 and divide by 1000)
            const reducedAmount = (withdrawal.amount * 999n) / 1000n;
            return { ...withdrawal, amount: reducedAmount };
          }
          return withdrawal;
        });

        const action = BundlerAction.metaMorphoReallocateTo(
          config.publicAllocator as `0x${string}`,
          vaultAddress,
          0n, // No fee for now
          reducedWithdrawals, // Use the reduced withdrawals
          MarketParams.get(marketId)
        );

        // Ensure the action is a proper hex string
        return action.startsWith("0x")
          ? (action as `0x${string}`)
          : (`0x${action}` as `0x${string}`);
      });

      // Send the transaction
      const result = await writeContractAsync({
        address: config.bundler as `0x${string}`,
        abi: BaseBundlerV2__factory.abi,
        functionName: "multicall",
        args: [multicallActions],
        value: parseEther("0"),
      });

      setTxHash(result);
      setIsTransactionSent(true);
    } catch (error) {
      console.error("Transaction failed:", error);
    }
  };

  const isArbitrum = networkId === 42161;

  return (
    <div>
      <button
        className={`px-4 py-2 rounded transition-colors ${
          isArbitrum
            ? "bg-gray-500 text-gray-300 cursor-not-allowed"
            : "bg-[#5792FF] text-white hover:bg-blue-600 disabled:bg-gray-400"
        }`}
        onClick={handleSendTransaction}
        disabled={isTransactionPending || isTransactionSent || isArbitrum}
      >
        {isTransactionPending ? "Sending..." : "Send Transaction"}
      </button>
      {isTransactionSuccessful && (
        <div className="mt-2 text-green-500">Transaction successful!</div>
      )}
    </div>
  );
}

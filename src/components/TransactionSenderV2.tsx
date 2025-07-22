import {
  MarketId,
  MarketParams,
} from "@morpho-org/blue-sdk";
import { getChainAddresses } from "../utils/chainAddresses";
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
      if (!config) {
        console.error(`Unsupported chain ID: ${networkId}`);
        alert(`Chain ID ${networkId} is not supported. Please switch to a supported network.`);
        return;
      }

      // Check if we have required addresses
      const bundlerAddress = config.bundler3?.bundler3 || config.bundler;
      if (!bundlerAddress) {
        console.error(`No bundler address found for chain ID: ${networkId}`);
        alert(`No bundler contract found for this network. Transaction cannot proceed.`);
        return;
      }

      if (!config.publicAllocator) {
        console.error(`No public allocator address found for chain ID: ${networkId}`);
        alert(`No public allocator contract found for this network. Transaction cannot proceed.`);
        return;
      }

      const filteredVaults = Object.entries(withdrawalsPerVault)
        .filter(([, withdrawals]) => withdrawals.some((w) => w.amount > 0n))
        .map(([vaultAddress]) => vaultAddress);

      if (filteredVaults.length === 0) {
        alert("No valid withdrawals to process.");
        return;
      }

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

        try {
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
        } catch (actionError) {
          console.error(`Failed to create bundler action for vault ${vaultAddress}:`, actionError);
          throw new Error(`Failed to create transaction data for vault ${vaultAddress}`);
        }
      });

      // Send the transaction
      const result = await writeContractAsync({
        address: bundlerAddress as `0x${string}`,
        abi: BaseBundlerV2__factory.abi,
        functionName: "multicall",
        args: [multicallActions],
        value: parseEther("0"),
      });

      setTxHash(result);
      setIsTransactionSent(true);
    } catch (error) {
      console.error("Transaction failed:", error);
      
      // Provide user-friendly error messages
      let errorMessage = "Transaction failed. Please try again.";
      
      if (error instanceof Error) {
        if (error.message.includes("User rejected")) {
          errorMessage = "Transaction was rejected by user.";
        } else if (error.message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds to complete the transaction.";
        } else if (error.message.includes("network")) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes("bundler")) {
          errorMessage = "Contract configuration error. Please contact support.";
        } else {
          errorMessage = `Transaction failed: ${error.message}`;
        }
      }
      
      alert(errorMessage);
    }
  };

  return (
    <div>
      <button
        className="px-4 py-2 bg-[#5792FF] text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
        onClick={handleSendTransaction}
        disabled={isTransactionPending || isTransactionSent}
      >
        {isTransactionPending ? "Sending..." : "Send Transaction"}
      </button>
      {isTransactionSuccessful && (
        <div className="mt-2 text-green-500">Transaction successful!</div>
      )}
    </div>
  );
}

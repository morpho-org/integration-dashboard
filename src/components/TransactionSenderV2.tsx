import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { BaseBundlerV2__factory } from "@morpho-org/morpho-blue-bundlers/types";
import { BundlerAction } from "@morpho-org/morpho-blue-bundlers/pkg";
import {
  getChainAddresses,
  MarketId,
  MarketParams,
} from "@morpho-org/blue-sdk";
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

      // Sort vaults for consistent ordering
      const sortedVaults = Object.keys(withdrawalsPerVault).sort();

      // Create multicall actions
      const multicallActions = sortedVaults.map((vaultAddress) => {
        const vaultWithdrawals = withdrawalsPerVault[vaultAddress];
        // Sort withdrawals within each vault
        vaultWithdrawals.sort((a, b) => (a.marketId > b.marketId ? 1 : -1));

        const action = BundlerAction.metaMorphoReallocateTo(
          config.publicAllocator,
          vaultAddress,
          0n, // No fee for now
          vaultWithdrawals,
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

  return (
    <div>
      <button
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
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

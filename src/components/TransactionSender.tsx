import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, Withdrawal } from "viem";
import abi from "../abis/publicAllocatorAbi.json";
import { publicAllocatorAddress } from "../config/constants";
import { MarketParams } from "../utils/types";

type TransactionSenderProps = {
  networkId: number;
  vaultAddress: string;
  withdrawals: Withdrawal[];
  supplyMarketParams: MarketParams;
};

export default function TransactionSender({
  networkId,
  vaultAddress,
  withdrawals,
  supplyMarketParams,
}: TransactionSenderProps) {
  const [isTransactionSent, setIsTransactionSent] = useState(false);

  const {
    writeContractAsync,
    isSuccess: isWriteSuccess,
    error: writeError,
  } = useWriteContract();

  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);

  const {
    isLoading: isTransactionPending,
    isSuccess: isTransactionSuccessful,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleSendTransaction = async () => {
    try {
      const result = await writeContractAsync({
        address: publicAllocatorAddress[networkId] as `0x${string}`,
        abi,
        functionName: "reallocateTo",
        args: [vaultAddress as `0x${string}`, withdrawals, supplyMarketParams],
        value: parseEther("0"), // 0 ETH value
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
        onClick={handleSendTransaction}
        className="submit-button"
        disabled={isTransactionPending || isTransactionSent}
      >
        {isTransactionPending ? "Sending..." : "Send Transaction"}
      </button>
      {isTransactionSuccessful && (
        <div className="success-message">Transaction successful!</div>
      )}
    </div>
  );
}

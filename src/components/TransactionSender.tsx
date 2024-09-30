import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import abi from "../abis/publicAllocatorAbi.json";
import { publicAllocatorAddress } from "../config/constants";
import { MarketParams, Withdrawal } from "../utils/types";

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
        style={{
          backgroundColor: "white",
          color: "black",
          padding: "10px 5px",
          borderRadius: "20px",
          border: "2px solid #ccc",
        }}
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

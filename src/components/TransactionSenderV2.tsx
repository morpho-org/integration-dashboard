import {
    getChainAddresses,
    MarketId,
    MarketParams
} from "@morpho-org/blue-sdk";
import { LiquidityLoader } from "@morpho-org/liquidity-sdk-viem";
import { useState } from "react";
import { Address, parseEther } from "viem";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { WithdrawalDetails } from "../core/publicAllocator";
import { encodePublicAllocatorReallocationBundle } from "../core/publicAllocatorTx";
import { initializeClient } from "../utils/client";

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
  const [isPreparingTx, setIsPreparingTx] = useState(false);
  const { sendTransactionAsync } = useSendTransaction();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const { isConnected, address: userAddress } = useAccount();

  const config = getChainAddresses(networkId);
  if (!config) throw new Error(`Unsupported chain ID: ${networkId}`);

  const supplyMarketParams = MarketParams.get(marketId);

  const {
    isLoading: isTransactionPending,
    isSuccess: isTransactionSuccessful,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleSendTransaction = async (event: React.MouseEvent) => {
    event.stopPropagation();

    if (!userAddress) {
      console.error("User address not available");
      return;
    }

    setIsPreparingTx(true);

    try {
      const { client } = await initializeClient(networkId);
      const loader = new LiquidityLoader(client as ConstructorParameters<typeof LiquidityLoader>[0], {
        maxWithdrawalUtilization: {},
        defaultMaxWithdrawalUtilization: parseEther("1"),
      });
      const { startState } = await loader.fetch(marketId);

      const tx = encodePublicAllocatorReallocationBundle(
        networkId,
        withdrawalsPerVault,
        supplyMarketParams,
        (vault: Address) => {
          const publicAllocatorConfig = startState.getVault(vault).publicAllocatorConfig;
          if (!publicAllocatorConfig) {
            throw new Error(`Missing public allocator config for vault ${vault}`);
          }
          return publicAllocatorConfig.fee;
        }
      );

      const result = await sendTransactionAsync({
        to: tx.to as Address,
        data: tx.data,
        value: tx.value,
      });

      setTxHash(result);
      setIsTransactionSent(true);
      console.log("✅ Transaction sent:", result);
    } catch (error) {
      console.error("❌ Transaction failed:", error);
    } finally {
      setIsPreparingTx(false);
    }
  };

  if (!isConnected) {
    return (
      <div>
        <button
          className="px-4 py-2 rounded bg-orange-500 text-white hover:bg-orange-600 transition-colors"
          disabled
        >
          Connect Wallet to Send Transaction
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        className="px-4 py-2 rounded transition-colors bg-[#5792FF] text-white hover:bg-blue-600 disabled:bg-gray-400"
        onClick={handleSendTransaction}
        disabled={isPreparingTx || isTransactionPending || isTransactionSent}
      >
        {isPreparingTx
          ? "Preparing..."
          : isTransactionPending
          ? "Sending..."
          : "Send Transaction"}
      </button>
      {isTransactionSuccessful && (
        <div className="mt-2 text-green-500">Transaction successful!</div>
      )}
    </div>
  );
}

import type { MarketParams } from "@morpho-org/morpho-sdk/blue/entities";
import type { VaultV2BlueReallocation } from "@morpho-org/morpho-sdk";
import { encodeFunctionData, erc20Abi, formatUnits } from "viem";
import { useMemo, useState } from "react";
import { useAccount, useSendTransaction, useSwitchChain } from "wagmi";
import { buildDirectAllocationTx } from "../core/publicAllocatorTx";
import { initializeClient } from "../utils/client";

interface TransactionSenderV2Props {
  networkId: number;
  targetMarketParams: MarketParams;
  reallocations: readonly VaultV2BlueReallocation[];
}

export default function TransactionSenderV2({
  networkId,
  targetMarketParams,
  reallocations,
}: TransactionSenderV2Props) {
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [transactionHash, setTransactionHash] = useState<`0x${string}`>();
  const [isSending, setIsSending] = useState(false);
  const allocation = useMemo(() => {
    try {
      return {
        value: buildDirectAllocationTx(
          networkId,
          targetMarketParams,
          reallocations,
        ),
      };
    } catch (cause) {
      return {
        error: cause instanceof Error ? cause.message : String(cause),
      };
    }
  }, [networkId, targetMarketParams, reallocations]);

  const switchNetwork = async () => {
    setError("");
    try {
      await switchChainAsync({ chainId: networkId });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const send = async () => {
    if (!address || !allocation.value) return;
    setError("");
    setProgress("");
    setTransactionHash(undefined);
    setIsSending(true);
    try {
      const { client } = await initializeClient(networkId);
      if (allocation.value.penaltyAssets > 0n) {
        const [balance, allowance, symbol, decimals] = await Promise.all([
          client.readContract({
            address: allocation.value.loanToken,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address],
          }),
          client.readContract({
            address: allocation.value.loanToken,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address, allocation.value.allocator],
          }),
          client.readContract({
            address: allocation.value.loanToken,
            abi: erc20Abi,
            functionName: "symbol",
          }),
          client.readContract({
            address: allocation.value.loanToken,
            abi: erc20Abi,
            functionName: "decimals",
          }),
        ]);
        const penalty = formatUnits(allocation.value.penaltyAssets, decimals);
        if (balance < allocation.value.penaltyAssets)
          throw new Error(
            `Insufficient ${symbol} balance for the ${penalty} ${symbol} penalty.`,
          );

        if (allowance < allocation.value.penaltyAssets) {
          if (allowance > 0n) {
            setProgress("Resetting existing penalty allowance…");
            const resetHash = await sendTransactionAsync({
              to: allocation.value.loanToken,
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "approve",
                args: [allocation.value.allocator, 0n],
              }),
              value: 0n,
              chainId: networkId,
            });
            const resetReceipt = await client.waitForTransactionReceipt({
              hash: resetHash,
            });
            if (resetReceipt.status !== "success")
              throw new Error("Resetting the penalty-token allowance failed.");
          }
          setProgress(`Approving ${penalty} ${symbol} penalty…`);
          const approvalHash = await sendTransactionAsync({
            to: allocation.value.loanToken,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: "approve",
              args: [allocation.value.allocator, allocation.value.penaltyAssets],
            }),
            value: 0n,
            chainId: networkId,
          });
          const receipt = await client.waitForTransactionReceipt({
            hash: approvalHash,
          });
          if (receipt.status !== "success")
            throw new Error("Penalty-token approval failed.");
        }
      }

      setProgress("Sending reallocation…");
      const hash = await sendTransactionAsync({
        to: allocation.value.tx.to,
        data: allocation.value.tx.data,
        value: 0n,
        chainId: networkId,
      });
      setTransactionHash(hash);
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success")
        throw new Error("The reallocation transaction failed.");
      setProgress("Reallocation completed.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setProgress("");
    } finally {
      setIsSending(false);
    }
  };

  if (!isConnected)
    return (
      <button className="rounded bg-gray-500 px-4 py-2 text-white" disabled>
        Connect wallet
      </button>
    );

  if (walletChainId !== networkId)
    return (
      <div className="space-y-2">
        <button
          className="rounded bg-blue-500 px-4 py-2 text-white"
          onClick={switchNetwork}
          type="button"
        >
          Switch network
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );

  return (
    <div className="space-y-2">
      <button
        className="rounded bg-blue-500 px-4 py-2 text-white disabled:opacity-50"
        disabled={isSending || !allocation.value || reallocations.length === 0}
        onClick={send}
        type="button"
      >
        {isSending ? "Sending…" : "Send"}
      </button>
      {allocation.error && (
        <p className="text-sm text-red-600">{allocation.error}</p>
      )}
      {progress && <p className="text-sm text-blue-700">{progress}</p>}
      {transactionHash && (
        <p className="break-all text-sm text-green-700">
          Transaction: {transactionHash}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

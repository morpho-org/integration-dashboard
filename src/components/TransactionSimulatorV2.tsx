import type { MarketParams } from "@morpho-org/morpho-sdk/blue/entities";
import type { VaultV2BlueReallocation } from "@morpho-org/morpho-sdk";
import { encodeFunctionData, erc20Abi, formatUnits, type Address } from "viem";
import { simulateCalls } from "viem/actions";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { buildDirectAllocationTx } from "../core/publicAllocatorTx";
import { initializeClient } from "../utils/client";

interface TransactionSimulatorV2Props {
  networkId: number;
  targetMarketParams: MarketParams;
  reallocations: readonly VaultV2BlueReallocation[];
}

const disconnectedSimulationAccount =
  "0x000000000000000000000000000000000000dEaD" as Address;

export default function TransactionSimulatorV2({
  networkId,
  targetMarketParams,
  reallocations,
}: TransactionSimulatorV2Props) {
  const { address } = useAccount();
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState<
    "none" | "success" | "error"
  >("none");
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [error, setError] = useState("");
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

  const simulate = async () => {
    setIsSimulating(true);
    setSimulationStatus("none");
    setError("");
    try {
      if (!allocation.value) throw new Error(allocation.error);
      const { client } = await initializeClient(networkId);
      if (allocation.value.penaltyAssets === 0n) {
        await client.call({
          to: allocation.value.tx.to,
          data: allocation.value.tx.data,
          value: 0n,
          account: address ?? disconnectedSimulationAccount,
        });
      } else {
        const [symbol, decimals] = await Promise.all([
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
        if (!address)
          throw new Error(
            `Connect a wallet holding ≥ ${penalty} ${symbol} to simulate penalty-bearing reallocations.`,
          );
        const balance = await client.readContract({
          address: allocation.value.loanToken,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
        });
        if (balance < allocation.value.penaltyAssets)
          throw new Error(
            `Connect a wallet holding ≥ ${penalty} ${symbol} to simulate penalty-bearing reallocations.`,
          );

        await simulateCalls(client, {
          account: address,
          calls: [
            {
              to: allocation.value.loanToken,
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "approve",
                args: [
                  allocation.value.allocator,
                  allocation.value.penaltyAssets,
                ],
              }),
            },
            {
              to: allocation.value.tx.to,
              data: allocation.value.tx.data,
              value: 0n,
            },
          ],
        });
      }
      setSimulationStatus("success");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(
        message.includes("eth_simulateV1")
          ? "RPC does not support eth_simulateV1; cannot simulate penalty flow."
          : message,
      );
      setSimulationStatus("error");
      setShowErrorModal(true);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          className="rounded bg-blue-500 px-4 py-2 text-white disabled:opacity-50"
          disabled={
            isSimulating || !allocation.value || reallocations.length === 0
          }
          onClick={simulate}
          type="button"
        >
          {isSimulating ? "Simulating…" : "Simulate"}
        </button>
        {simulationStatus === "success" && (
          <span className="text-green-700">Simulation successful</span>
        )}
        {simulationStatus === "error" && (
          <button
            className="text-red-600 underline"
            onClick={() => setShowErrorModal(true)}
            type="button"
          >
            Simulation failed
          </button>
        )}
      </div>
      {allocation.error && (
        <p className="mt-2 text-sm text-red-600">{allocation.error}</p>
      )}
      {showErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg bg-gray-800 p-6 text-white">
            <h2 className="mb-4 text-lg font-bold">Simulation Error</h2>
            <pre className="flex-1 overflow-y-auto whitespace-pre-wrap break-all text-sm text-red-300">
              {error || "Unknown error occurred"}
            </pre>
            <button
              className="mt-4 rounded bg-blue-500 px-4 py-2"
              onClick={() => setShowErrorModal(false)}
              type="button"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

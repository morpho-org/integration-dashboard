import {
    getChainAddresses,
    MarketId,
    MarketParams
} from "@morpho-org/blue-sdk";
import { LiquidityLoader } from "@morpho-org/liquidity-sdk-viem";
import { useState } from "react";
import { Address, parseEther } from "viem";
import { WithdrawalDetails } from "../core/publicAllocator";
import { encodePublicAllocatorReallocationBundle } from "../core/publicAllocatorTx";
import { initializeClient } from "../utils/client";

type TransactionSimulatorV2Props = {
  networkId: number;
  marketId: MarketId;
  withdrawalsPerVault: { [vaultAddress: string]: WithdrawalDetails[] };
};

const simulationUserAddress: Address = "0x7f7A70b5B584C4033CAfD52219a496Df9AFb1af7";

export default function TransactionSimulatorV2({
  networkId,
  marketId,
  withdrawalsPerVault,
}: TransactionSimulatorV2Props) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState<
    "none" | "success" | "error"
  >("none");
  const [showErrorModal, setShowErrorModal] = useState(false);

  const config = getChainAddresses(networkId);
  if (!config) throw new Error(`Unsupported chain ID: ${networkId}`);

  const supplyMarketParams = MarketParams.get(marketId);
  const [error, setError] = useState<Error | null>(null);

  const simulateTransaction = async () => {
    setSimulationStatus("none");
    setError(null);

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

      // Fund the simulation account with ETH if needed (for Anvil/Hardhat)
      try {
        await (client.request as (args: { method: string; params: unknown[] }) => Promise<unknown>)({
          method: "anvil_setBalance",
          params: [simulationUserAddress, `0x${parseEther("1000").toString(16)}`],
        });
        console.log(`💰 Funded simulation account ${simulationUserAddress} with 1000 ETH`);
      } catch (fundError) {
        console.warn(
          "⚠️ Could not fund account (might not be using Anvil):",
          fundError
        );
      }

      console.log("🚀 Simulating public allocator reallocation bundle...");
      await client.call({
        to: tx.to as Address,
        data: tx.data,
        value: tx.value,
        account: simulationUserAddress,
      });

      console.log("✅ Simulation successful:", {
        to: tx.to,
        data: tx.data,
        value: tx.value.toString(),
      });
      setSimulationStatus("success");
    } catch (err) {
      console.error("❌ Simulation failed:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setSimulationStatus("error");
    }
  };

  const handleSimulate = async () => {
    setIsSimulating(true);
    await simulateTransaction();
    setIsSimulating(false);
  };

  const handleErrorClick = () => {
    if (simulationStatus === 'error') {
      setShowErrorModal(true);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSimulate}
          disabled={isSimulating}
          className="px-4 py-2 rounded transition-colors bg-[#5792FF] text-white hover:bg-blue-500/30 disabled:opacity-50"
        >
          {isSimulating ? "Simulating..." : "Simulate Changes"}
        </button>

        {simulationStatus === "success" && (
          <span className="text-green-400">✓ Simulation validated</span>
        )}

        {simulationStatus === "error" && (
          <span
            className="text-red-400 cursor-pointer hover:underline"
            onClick={handleErrorClick}
          >
            ✗ Simulation failed
          </span>
        )}
      </div>

      {showErrorModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
            <h2 className="text-lg font-bold mb-4 text-white">
              Simulation Error
            </h2>
            <div className="overflow-y-auto flex-1">
              <pre className="text-red-400 text-sm break-all whitespace-pre-wrap">
                {error?.message || "Unknown error occurred"}
              </pre>
            </div>
            <button
              onClick={() => setShowErrorModal(false)}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

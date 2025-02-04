import { useState, useEffect } from "react";
import { useSimulateContract } from "wagmi";
import { parseEther } from "viem";
import { BaseBundlerV2__factory } from "@morpho-org/morpho-blue-bundlers/types";
import { BundlerAction } from "@morpho-org/morpho-blue-bundlers/pkg";
import {
  getChainAddresses,
  MarketId,
  MarketParams,
} from "@morpho-org/blue-sdk";
import { WithdrawalDetails } from "../core/publicAllocator";

type TransactionSimulatorV2Props = {
  networkId: number;
  marketId: MarketId;
  withdrawalsPerVault: { [vaultAddress: string]: WithdrawalDetails[] };
};

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

  // Ensure consistent ordering of vaults and withdrawals
  const sortedVaults = Object.keys(withdrawalsPerVault).sort();
  const multicallActions = sortedVaults.map((vaultAddress) => {
    const vaultWithdrawals = withdrawalsPerVault[vaultAddress];
    // Sort withdrawals by market id for consistency
    vaultWithdrawals.sort((a, b) => (a.marketId > b.marketId ? 1 : -1));

    const action = BundlerAction.metaMorphoReallocateTo(
      config.publicAllocator,
      vaultAddress,
      0n, // No fee for now
      vaultWithdrawals,
      MarketParams.get(marketId)
    );
    // Ensure proper hex string formatting
    return action.startsWith("0x")
      ? (action as `0x${string}`)
      : (`0x${action}` as `0x${string}`);
  });

  // Destructure error along with simulation, isError, and isLoading
  const {
    data: simulation,
    isError,
    error,
    isLoading,
  } = useSimulateContract({
    address: config.bundler as `0x${string}`,
    abi: BaseBundlerV2__factory.abi,
    functionName: "multicall",
    args: [multicallActions],
    value: parseEther("0"),
  });

  // When the user clicks "Simulate Changes", mark simulation as in progress
  const handleSimulate = () => {
    setIsSimulating(true);
    setSimulationStatus("none");
  };

  // Wait 1 second (or until the simulation loading flag clears) before checking the result.
  useEffect(() => {
    if (isSimulating && !isLoading) {
      const timer = setTimeout(() => {
        if (simulation) {
          setSimulationStatus("success");
        } else if (isError) {
          setSimulationStatus("error");
        }
        setIsSimulating(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isSimulating, isLoading, simulation, isError]);

  // Add handler for error click
  const handleErrorClick = () => {
    if (isError) {
      setShowErrorModal(true);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSimulate}
          disabled={isSimulating}
          className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors disabled:opacity-50"
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

      {/* Modal for displaying error details */}
      {showErrorModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-2xl w-full">
            <h2 className="text-lg font-bold mb-4 text-white">
              Simulation Error
            </h2>
            <pre className="text-red-400 text-sm break-all whitespace-pre-wrap">
              {error?.message || "Unknown error occurred"}
            </pre>
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

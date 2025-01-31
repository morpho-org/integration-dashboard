import { useState } from "react";
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

    return action.startsWith("0x")
      ? (action as `0x${string}`)
      : (`0x${action}` as `0x${string}`);
  });

  // Use the useSimulateContract hook
  const { data: simulation, isError } = useSimulateContract({
    address: config.bundler as `0x${string}`,
    abi: BaseBundlerV2__factory.abi,
    functionName: "multicall",
    args: [multicallActions],
    value: parseEther("0"),
  });

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      if (simulation) {
        setSimulationStatus("success");
      } else if (isError) {
        setSimulationStatus("error");
      }
    } catch (err) {
      setSimulationStatus("error");
    } finally {
      setIsSimulating(false);
    }
  };

  return (
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
        <span className="text-red-400">✗ Simulation failed</span>
      )}
    </div>
  );
}

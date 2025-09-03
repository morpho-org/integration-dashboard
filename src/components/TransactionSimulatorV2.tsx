import {
  getChainAddresses,
  MarketId,
  MarketParams,
} from "@morpho-org/blue-sdk";
import { LiquidityLoader } from "@morpho-org/liquidity-sdk-viem"; // Import LiquidityLoader
import {
  BundlerOperation,
  encodeBundle,
} from "@morpho-org/bundler-sdk-viem";
import { produceImmutable } from "@morpho-org/simulation-sdk"; // Import produceImmutable
import { useState } from "react";
import { Address, parseEther } from "viem";
import { WithdrawalDetails } from "../core/publicAllocator";
import { initializeClient } from "../utils/client";

type TransactionSimulatorV2Props = {
  networkId: number;
  marketId: MarketId;
  withdrawalsPerVault: { [vaultAddress: string]: WithdrawalDetails[] };
};

/**
 * Helper function to create reallocation operations for simulation
 */
function createSimulationReallocationOperations(
  userAddress: Address,
  withdrawalsPerVault: { [vaultAddress: string]: WithdrawalDetails[] },
  supplyMarketParams: MarketParams
): BundlerOperation[] {
  const operations: BundlerOperation[] = [];

  // Filter vaults with non-zero withdrawals
  const filteredVaults = Object.keys(withdrawalsPerVault).filter(
    (vaultAddress) =>
      withdrawalsPerVault[vaultAddress].length > 0 &&
      withdrawalsPerVault[vaultAddress].some((withdrawal) => withdrawal.amount > 0n)
  );

  for (const vaultAddress of filteredVaults) {
    const vaultWithdrawals = withdrawalsPerVault[vaultAddress];
    // Sort withdrawals within each vault
    vaultWithdrawals.sort((a, b) => (a.marketId > b.marketId ? 1 : -1));

    // Create reduced withdrawals (0.1% less for simulation safety)
    const reducedWithdrawals = vaultWithdrawals
      .filter(withdrawal => withdrawal.amount > 0n)
      .map(withdrawal => ({
        id: withdrawal.marketId,
        assets: (withdrawal.amount * 999n) / 1000n, // Reduce by 0.1%
      }));

    if (reducedWithdrawals.length > 0) {
      operations.push({
        type: "MetaMorpho_PublicReallocate",
        sender: userAddress,
        address: vaultAddress as Address,
        args: {
          withdrawals: reducedWithdrawals,
          supplyMarketId: supplyMarketParams.id,
        },
      });
    }
  }

  return operations;
}

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

  // Create simulation user address (same as used in publicAllocator.ts)
  const simulationUserAddress: Address = "0x7f7A70b5B584C4033CAfD52219a496Df9AFb1af7";
  const supplyMarketParams = MarketParams.get(marketId);

  // Create reallocation operations using modern bundler SDK
  const reallocationOperations = createSimulationReallocationOperations(
    simulationUserAddress,
    withdrawalsPerVault,
    supplyMarketParams
  );

  const [error, setError] = useState<Error | null>(null);

  // Correct simulation using LiquidityLoader and real SimulationState
  const simulateTransaction = async () => {
    setSimulationStatus("none");
    setError(null);

    if (reallocationOperations.length === 0) {
      setError(new Error("No reallocation operations to simulate."));
      setSimulationStatus("error");
      return;
    }

    try {
      const { client } = await initializeClient(networkId);
      
      // 1. Use LiquidityLoader to fetch the REAL simulation state
      const loader = new LiquidityLoader(client as any, {
        maxWithdrawalUtilization: {},
        defaultMaxWithdrawalUtilization: parseEther("1"),
      });
      
      // Fetch all markets involved: the target market + all source markets
      const allMarketIds = [
        marketId,
        ...reallocationOperations.flatMap(op => 
          op.type === "MetaMorpho_PublicReallocate" 
            ? op.args.withdrawals.map(w => w.id) 
            : []
        )
      ];
      
      // Fetch the primary market first, then additional markets if any
      let fetchResult;
      if (allMarketIds.length === 1) {
        fetchResult = await loader.fetch(allMarketIds[0]);
      } else {
        // For multiple markets, we need to call fetch with proper spread
        const [first, ...rest] = allMarketIds;
        fetchResult = await (loader.fetch as any)(first, ...rest);
      }
      const { startState } = fetchResult;

      // 2. Prepare the fetched state for simulation (add user and funds)
      const preparedState = produceImmutable(startState, (draft) => {
        // Ensure user exists
        if (!draft.users[simulationUserAddress]) {
          draft.users[simulationUserAddress] = {
            address: simulationUserAddress,
            isBundlerAuthorized: true, // Must be true for bundler operations
            morphoNonce: 0n,
          };
        }
        
        // Ensure holdings object exists for the user
        if (!draft.holdings[simulationUserAddress]) {
          draft.holdings[simulationUserAddress] = {};
        }
        
        // Add ETH for gas fees
        draft.holdings[simulationUserAddress]["0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"] = {
          balance: parseEther("1000"),
          user: simulationUserAddress,
          token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
          erc20Allowances: {
            morpho: 0n,
            permit2: 0n,
            "bundler3.generalAdapter1": 0n,
          },
          permit2BundlerAllowance: { amount: 0n, expiration: 0n, nonce: 0n },
        };
      });

      // 3. Encode the bundle with the CORRECT, complete state
      console.log("🔧 Encoding bundle with real simulation state...");
      const bundle = encodeBundle(
        reallocationOperations,
        preparedState, // Use the fetched and prepared state
        false
      );
      const tx = bundle.tx();

      // Fund the simulation account with ETH if needed (for Anvil/Hardhat)
      try {
        await client.request({
          method: "anvil_setBalance" as any,
          params: [simulationUserAddress, `0x${parseEther("1000").toString(16)}`],
        });
        console.log(`💰 Funded simulation account ${simulationUserAddress} with 1000 ETH`);
      } catch (fundError) {
        console.warn(
          "⚠️ Could not fund account (might not be using Anvil):",
          fundError
        );
      }

      // 4. Simulate the transaction using eth_call
      console.log("🚀 Simulating transaction...");
      await client.call({
        to: tx.to as Address,
        data: tx.data,
        value: tx.value || 0n,
        account: simulationUserAddress,
      });

      console.log("✅ Simulation successful:", {
        to: tx.to,
        data: tx.data,
        value: tx.value?.toString() || "0",
      });
      setSimulationStatus("success");
    } catch (err) {
      console.error("❌ Simulation failed:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setSimulationStatus("error");
    }
  };

  // When the user clicks "Simulate Changes", run the simulation
  const handleSimulate = async () => {
    setIsSimulating(true);
    await simulateTransaction();
    setIsSimulating(false);
  };

  // Add handler for error click
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

      {/* Modal for displaying error details */}
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

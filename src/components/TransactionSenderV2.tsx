import {
  getChainAddresses,
  MarketId,
  MarketParams,
} from "@morpho-org/blue-sdk";
import { LiquidityLoader } from "@morpho-org/liquidity-sdk-viem";
import {
  BundlerOperation,
  encodeBundle,
} from "@morpho-org/bundler-sdk-viem";
import { produceImmutable } from "@morpho-org/simulation-sdk";
import { useState } from "react";
import { Address, parseEther } from "viem";
import { useAccount, useWaitForTransactionReceipt, useSendTransaction } from "wagmi";
import { WithdrawalDetails } from "../core/publicAllocator";
import { initializeClient } from "../utils/client";

type TransactionSenderV2Props = {
  networkId: number;
  marketId: MarketId;
  withdrawalsPerVault: { [vaultAddress: string]: WithdrawalDetails[] };
};

/**
 * Helper function to create reallocation operations for transaction
 * (Same as in TransactionSimulatorV2 to ensure consistency)
 */
function createReallocationOperations(
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

    // Create reduced withdrawals (0.1% less for safety)
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
      // 1. Create reallocation operations using the same logic as simulator
      const reallocationOperations = createReallocationOperations(
        userAddress,
        withdrawalsPerVault,
        supplyMarketParams
      );

      if (reallocationOperations.length === 0) {
        throw new Error("No reallocation operations to execute");
      }

      // 2. Fetch real simulation state using LiquidityLoader
      const { client } = await initializeClient(networkId);
      const loader = new LiquidityLoader(client as any, {
        maxWithdrawalUtilization: {},
        defaultMaxWithdrawalUtilization: parseEther("1"),
      });

      // Fetch all markets involved
      const allMarketIds = [
        marketId,
        ...reallocationOperations.flatMap(op => 
          op.type === "MetaMorpho_PublicReallocate" 
            ? op.args.withdrawals.map(w => w.id) 
            : []
        )
      ];
      
      // Fetch the state
      let fetchResult;
      if (allMarketIds.length === 1) {
        fetchResult = await loader.fetch(allMarketIds[0]);
      } else {
        const [first, ...rest] = allMarketIds;
        fetchResult = await (loader.fetch as any)(first, ...rest);
      }
      const { startState } = fetchResult;

      // 3. Prepare the state with user data
      const preparedState = produceImmutable(startState, (draft) => {
        // Ensure user exists
        if (!draft.users[userAddress]) {
          draft.users[userAddress] = {
            address: userAddress,
            isBundlerAuthorized: true,
            morphoNonce: 0n,
          };
        }
        
        // Ensure holdings exist (user should have actual holdings from wallet)
        if (!draft.holdings[userAddress]) {
          draft.holdings[userAddress] = {};
        }
      });

      // 4. Encode the bundle with real state
      const bundle = encodeBundle(
        reallocationOperations,
        preparedState,
        false
      );
      const tx = bundle.tx();

      // 5. Send the transaction using wagmi
      const result = await sendTransactionAsync({
        to: tx.to as Address,
        data: tx.data,
        value: tx.value || 0n,
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

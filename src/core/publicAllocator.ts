import {
    getChainAddresses,
    Market,
    MarketId,
    MarketParams,
    MathLib
} from "@morpho-org/blue-sdk";
import "@morpho-org/blue-sdk-viem/lib/augment";
import { LiquidityLoader } from "@morpho-org/liquidity-sdk-viem";
import { computeReallocations, type VaultReallocation } from "@morpho-org/morpho-sdk";
import type { ReallocationData } from "@morpho-org/morpho-sdk/entities";
import {
    createClient,
    formatUnits,
    parseEther
} from "viem";
import { getBlock } from "viem/actions";
import { getChainConfig } from "../config/chains";
import { fetchMarketTargets } from "../fetchers/fetchApiTargets";
import { createProxyTransport } from "../utils/client";

/**
 * The default target utilization above which the shared liquidity algorithm is triggered (scaled by WAD).
 */
export const DEFAULT_SUPPLY_TARGET_UTILIZATION = 905000000000000000n;

const REALLOCATION_SIMULATION_DELAY = 3600n;

/**
 * Helper function to convert a number (decimal APY) to WAD-scaled bigint.
 * The new SDK returns APYs as numbers (e.g., 0.05 for 5%), we need to convert to WAD scale.
 */
function toWadBigInt(value: number | bigint | undefined): bigint {
  if (value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  return BigInt(Math.floor(value * 1e18));
}

export interface WithdrawalDetails {
  marketId: MarketId;
  marketParams: MarketParams;
  amount: bigint;
  sourceMarketLiquidity: bigint;
}

export interface ProcessedWithdrawals {
  withdrawalsPerVault: { [vaultAddress: string]: WithdrawalDetails[] };
  totalReallocated: bigint;
}

export interface MarketSimulationResult {
  preReallocation: {
    liquidity: bigint;
    borrowApy: bigint;
    utilization: bigint;
  };
  postReallocation: {
    liquidity: bigint;
    borrowApy: bigint;
    reallocatedAmount: bigint;
    utilization: bigint;
  };
}

export interface SimulationResults {
  targetMarket: MarketSimulationResult & {
    postBorrow: {
      liquidity: bigint;
      borrowApy: bigint;
      borrowAmount: bigint;
      utilization: bigint;
    };
  };
  sourceMarkets: {
    [marketId: string]: MarketSimulationResult;
  };
}

interface Asset {
  address: string;
  symbol: string;
}

interface AllocationMarket {
  uniqueKey: string;
  collateralAsset: Asset;
  loanAsset: Asset;
  lltv: string;
  targetBorrowUtilization: string;
  targetWithdrawUtilization: string;
  state: {
    utilization: number;
    supplyAssets: bigint;
    borrowAssets: bigint;
  };
}

interface Vault {
  address: string;
  name: string;
}

interface SharedLiquidity {
  assets: string;
  vault: Vault;
  allocationMarket: AllocationMarket;
}

export interface ReallocationResult {
  requestedLiquidity: bigint;
  currentMarketLiquidity: bigint;
  apiMetrics: {
    currentMarketLiquidity: bigint;
    reallocatableLiquidity: bigint;
    decimals: number;
    priceUsd: number;
    symbol: string;
    loanAsset: {
      address: string;
      symbol: string;
    };
    collateralAsset: {
      address: string;
      symbol: string;
    };
    lltv: bigint;
    publicAllocatorSharedLiquidity: SharedLiquidity[];
    utilization: bigint;
    targetBorrowUtilization?: bigint;
    targetWithdrawUtilization?: bigint;
    maxBorrowWithoutReallocation?: bigint;
  };
  simulation?: SimulationResults;
  reallocation?: {
    withdrawals: ProcessedWithdrawals;
    liquidityNeededFromReallocation: bigint;
    reallocatableLiquidity: bigint;
    isLiquidityFullyMatched: boolean;
    liquidityShortfall: bigint;
  };
  rawTransaction?: {
    to: string;
    data: string;
    value: string;
  };
  reason?: {
    type: "success" | "error";
    message: string;
  };
}

// For displaying metrics across multiple markets efficiently, use the API
const API_URL = "https://blue-api.morpho.org/graphql";
const MARKET_QUERY = `
query MarketByUniqueKeyReallocatable($uniqueKey: String!, $chainId: Int!) {
  marketByUniqueKey: marketById(marketId: $uniqueKey, chainId: $chainId) {
    reallocatableLiquidityAssets
    targetBorrowUtilization
    targetWithdrawUtilization
    publicAllocatorSharedLiquidity {
      assets
      vault {
        address
        name
      }
      allocationMarket: withdrawMarket {
        targetBorrowUtilization
        targetWithdrawUtilization
        state {
          utilization
          supplyAssets
          borrowAssets
        } 
        uniqueKey: marketId
        collateralAsset {
          address
          symbol
        }
        loanAsset {
          address
          symbol
        }
        lltv
      }
      
    }
    loanAsset {
      address
      decimals
      priceUsd
      symbol
    }
    collateralAsset {
      address
      decimals
      priceUsd
      symbol
    }
    lltv
    state {
      liquidityAssets
      utilization
    }
  }
}
`;

/**
 * Initialize a viem client and LiquidityLoader for blockchain interactions.
 *
 * Uses the secure RPC proxy transport to keep RPC URLs server-side only.
 * All RPC requests are routed through /api/rpc/[chainId] which forwards
 * to the actual RPC provider without exposing API keys to the client.
 */
async function initializeClientAndLoader(chainId: number) {
  const chainConfig = getChainConfig(chainId);
  if (!chainConfig) throw new Error(`Unsupported chain ID: ${chainId}`);

  // Use secure proxy transport - RPC URLs stay server-side
  const client = createClient({
    chain: chainConfig.viemChain,
    transport: createProxyTransport(chainId),
    batch: {
      multicall: {
        batchSize: 1024,
        wait: 100,
      },
    },
  });

  const config = getChainAddresses(chainId);
  if (!config) throw new Error(`Unsupported chain ID: ${chainId}`);
  return {
    client,
    config,
    loader: new LiquidityLoader(client, {
      maxWithdrawalUtilization: {},
      defaultMaxWithdrawalUtilization: parseEther("1"),
    }),
  };
}

function parseOptionalBigInt(value: bigint | string | null | undefined) {
  if (value == null) return undefined;
  try {
    return typeof value === "bigint" ? value : BigInt(value);
  } catch {
    return undefined;
  }
}

async function fetchMarketMetricsFromAPI(marketId: MarketId, chainId: number) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: MARKET_QUERY,
      variables: { uniqueKey: marketId, chainId },
    }),
  });

  interface MarketAPIData {
    state: { utilization: number; liquidityAssets: string };
    reallocatableLiquidityAssets: string;
    targetBorrowUtilization?: string | null;
    targetWithdrawUtilization?: string | null;
    loanAsset: { decimals: number; priceUsd: number; symbol: string; address: string };
    collateralAsset: { address: string; decimals: number; symbol: string };
    lltv: string;
    publicAllocatorSharedLiquidity: Array<{
      assets: string;
      vault: { address: string; name?: string };
      allocationMarket: AllocationMarket;
    }>;
  }
  const data = await response.json() as { data?: { marketByUniqueKey?: MarketAPIData } };
  const marketData = data?.data?.marketByUniqueKey;

  if (!marketData) throw new Error("Market data not found");

  // Convert decimal utilization to WAD-scaled bigint
  const utilizationWad = BigInt(
    Math.floor(marketData.state.utilization * 1e18)
  );

  return {
    utilization: utilizationWad, // Now WAD-scaled
    currentMarketLiquidity: BigInt(marketData.state.liquidityAssets),
    reallocatableLiquidity: BigInt(marketData.reallocatableLiquidityAssets),
    decimals: marketData.loanAsset.decimals,
    priceUsd: marketData.loanAsset.priceUsd,
    symbol: marketData.loanAsset.symbol,
    loanAsset: marketData.loanAsset,
    collateralAsset: marketData.collateralAsset,
    lltv: BigInt(marketData.lltv),
    targetBorrowUtilization: parseOptionalBigInt(marketData.targetBorrowUtilization),
    targetWithdrawUtilization: parseOptionalBigInt(marketData.targetWithdrawUtilization),
    publicAllocatorSharedLiquidity:
      marketData.publicAllocatorSharedLiquidity.map((item) => ({
        assets: item.assets,
        vault: { address: item.vault.address, name: item.vault.name || item.vault.address },
        allocationMarket: item.allocationMarket,
      })),
  };
}

async function fetchMarketData(loader: LiquidityLoader, marketId: MarketId) {
  const rpcData = await loader.fetch(marketId);
  return {
    rpcData,
    hasReallocatableLiquidity: rpcData.withdrawals.length > 0,
  };
}

function getSupplyTargetUtilization(
  marketId: MarketId,
  supplyTargetUtilization: Record<MarketId, bigint | undefined>
) {
  return supplyTargetUtilization[marketId] ?? DEFAULT_SUPPLY_TARGET_UTILIZATION;
}

function mergeApiMarketTargets(
  marketId: MarketId,
  apiMetrics: ReallocationResult["apiMetrics"],
  supplyTargetUtilization: Record<MarketId, bigint | undefined>,
  maxWithdrawalUtilization: Record<MarketId, bigint | undefined>
) {
  const mergedSupplyTargetUtilization = { ...supplyTargetUtilization };
  const mergedMaxWithdrawalUtilization = { ...maxWithdrawalUtilization };

  if (apiMetrics.targetBorrowUtilization != null) {
    mergedSupplyTargetUtilization[marketId] = apiMetrics.targetBorrowUtilization;
  }
  if (apiMetrics.targetWithdrawUtilization != null) {
    mergedMaxWithdrawalUtilization[marketId] = apiMetrics.targetWithdrawUtilization;
  }

  for (const { allocationMarket } of apiMetrics.publicAllocatorSharedLiquidity) {
    const allocationMarketId = allocationMarket.uniqueKey as MarketId;
    const targetBorrowUtilization = parseOptionalBigInt(
      allocationMarket.targetBorrowUtilization
    );
    const targetWithdrawUtilization = parseOptionalBigInt(
      allocationMarket.targetWithdrawUtilization
    );

    if (targetBorrowUtilization != null) {
      mergedSupplyTargetUtilization[allocationMarketId] = targetBorrowUtilization;
    }
    if (targetWithdrawUtilization != null) {
      mergedMaxWithdrawalUtilization[allocationMarketId] = targetWithdrawUtilization;
    }
  }

  return {
    supplyTargetUtilization: mergedSupplyTargetUtilization,
    maxWithdrawalUtilization: mergedMaxWithdrawalUtilization,
  };
}

function getMaxBorrowWithoutReallocation(market: Market, supplyTargetUtilization: bigint) {
  return MathLib.zeroFloorSub(
    MathLib.wMulUp(supplyTargetUtilization, market.totalSupplyAssets),
    market.totalBorrowAssets
  );
}

function getTotalReallocated(reallocations: readonly VaultReallocation[]) {
  return reallocations.reduce(
    (acc, reallocation) =>
      acc + reallocation.withdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0n),
    0n
  );
}

function getWithdrawalsPerVault(
  reallocations: readonly VaultReallocation[],
  startState: ReallocationData
): ProcessedWithdrawals {
  const withdrawalsPerVault: ProcessedWithdrawals["withdrawalsPerVault"] = {};
  let totalReallocated = 0n;

  for (const reallocation of reallocations) {
    const vaultWithdrawals = (withdrawalsPerVault[reallocation.vault] ??= []);
    for (const withdrawal of reallocation.withdrawals) {
      const sourceMarket = startState.getMarket(withdrawal.marketParams.id);
      vaultWithdrawals.push({
        marketId: withdrawal.marketParams.id,
        marketParams: withdrawal.marketParams,
        amount: withdrawal.amount,
        sourceMarketLiquidity: sourceMarket.liquidity,
      });
      totalReallocated += withdrawal.amount;
    }
  }

  return { withdrawalsPerVault, totalReallocated };
}

function getSourceReallocatedAmounts(withdrawals: ProcessedWithdrawals) {
  const amounts: Record<MarketId, bigint> = {};
  for (const vaultWithdrawals of Object.values(withdrawals.withdrawalsPerVault)) {
    for (const withdrawal of vaultWithdrawals) {
      amounts[withdrawal.marketId] =
        (amounts[withdrawal.marketId] ?? 0n) + withdrawal.amount;
    }
  }
  return amounts;
}

function marketSnapshot(market: Market) {
  return {
    liquidity: market.liquidity,
    borrowApy: toWadBigInt(market.borrowApy),
    utilization: market.utilization,
  };
}

function applySupply(market: Market, amount: bigint, timestamp: bigint) {
  return amount === 0n ? market : market.supply(amount, 0n, timestamp).market;
}

function applyBorrow(market: Market, amount: bigint, timestamp: bigint) {
  return amount === 0n ? market : market.borrow(amount, 0n, timestamp).market;
}

function applyWithdraw(market: Market, amount: bigint, timestamp: bigint) {
  return amount === 0n ? market : market.withdraw(amount, 0n, timestamp).market;
}

// Backward-compatible legacy entrypoint. The implementation now uses the same
// morpho-sdk public allocator planner as the market simulation dashboard.
export async function compareAndReallocate(
  marketId: MarketId,
  chainId: number,
  requestedLiquidity: bigint
): Promise<ReallocationResult> {
  return fetchMarketSimulationBorrow(marketId, chainId, requestedLiquidity);
}

export async function fetchMarketSimulationBorrow(
  marketId: MarketId,
  chainId: number,
  requestedLiquidity: bigint
): Promise<ReallocationResult> {
  const result: ReallocationResult = {
    requestedLiquidity,
    currentMarketLiquidity: 0n,
    apiMetrics: {
      utilization: 0n,
      maxBorrowWithoutReallocation: 0n,
      currentMarketLiquidity: 0n,
      reallocatableLiquidity: 0n,
      decimals: 0,
      priceUsd: 0,
      symbol: "",
      loanAsset: { address: "", symbol: "" },
      collateralAsset: { address: "", symbol: "" },
      lltv: 0n,
      publicAllocatorSharedLiquidity: [],
    },
  };

  try {
    const { client, loader } = await initializeClientAndLoader(chainId);
    const {
      supplyTargetUtilization,
      maxWithdrawalUtilization,
      reallocatableVaults,
    } = await fetchMarketTargets(chainId);

    const [apiMetrics, market, block] = await Promise.all([
      fetchMarketMetricsFromAPI(marketId, chainId),
      Market.fetch(marketId, client),
      getBlock(client),
    ]);

    result.apiMetrics = apiMetrics;
    result.currentMarketLiquidity = market.liquidity;

    const { rpcData } = await fetchMarketData(loader, marketId);

    if (!rpcData || !rpcData.startState) {
      result.reason = {
        type: "error",
        message: "Market data unavailable",
      };
      return result;
    }

    const startState = rpcData.startState;
    const initialMarket = startState.getMarket(marketId);

    if (!initialMarket || !initialMarket.params) {
      result.reason = {
        type: "error",
        message: "Invalid market data",
      };
      return result;
    }

    const targetOverrides = mergeApiMarketTargets(
      marketId,
      apiMetrics,
      supplyTargetUtilization,
      maxWithdrawalUtilization
    );
    const targetUtilization = getSupplyTargetUtilization(
      marketId,
      targetOverrides.supplyTargetUtilization
    );
    result.apiMetrics.maxBorrowWithoutReallocation = getMaxBorrowWithoutReallocation(
      initialMarket,
      targetUtilization
    );

    // Scale the requested liquidity with the correct decimals
    const scaledRequestedLiquidity =
      requestedLiquidity * BigInt(10 ** apiMetrics.decimals);
    const reallocationTimestamp = block.timestamp + REALLOCATION_SIMULATION_DELAY;

    const reallocations = scaledRequestedLiquidity === 0n
      ? []
      : computeReallocations({
          reallocationData: startState,
          marketId,
          operation: "borrow",
          amount: scaledRequestedLiquidity,
          options: {
            enabled: true,
            timestamp: reallocationTimestamp,
            defaultSupplyTargetUtilization: DEFAULT_SUPPLY_TARGET_UTILIZATION,
            supplyTargetUtilization: targetOverrides.supplyTargetUtilization,
            maxWithdrawalUtilization: targetOverrides.maxWithdrawalUtilization,
            reallocatableVaults,
          },
        });

    const reallocatedAmount = getTotalReallocated(reallocations);
    const marketBeforeBorrow = applySupply(
      initialMarket,
      reallocatedAmount,
      reallocationTimestamp
    );
    const simulatedFinalMarket = applyBorrow(
      marketBeforeBorrow,
      scaledRequestedLiquidity,
      reallocationTimestamp
    );
    const withdrawals = getWithdrawalsPerVault(reallocations, startState);

    const sourceMarkets: { [marketId: string]: MarketSimulationResult } = {};
    const sourceReallocatedAmounts = getSourceReallocatedAmounts(withdrawals);
    for (const [sourceMarketId, sourceReallocatedAmount] of Object.entries(sourceReallocatedAmounts)) {
      const sourceMarketInitial = startState.getMarket(sourceMarketId as MarketId);
      const sourceMarketAfterReallocation = applyWithdraw(
        sourceMarketInitial,
        sourceReallocatedAmount,
        reallocationTimestamp
      );

      sourceMarkets[sourceMarketId] = {
        preReallocation: marketSnapshot(sourceMarketInitial),
        postReallocation: {
          ...marketSnapshot(sourceMarketAfterReallocation),
          reallocatedAmount: sourceReallocatedAmount,
        },
      };
    }

    result.simulation = {
      targetMarket: {
        preReallocation: marketSnapshot(initialMarket),
        postReallocation: {
          ...marketSnapshot(marketBeforeBorrow),
          reallocatedAmount,
        },
        postBorrow: {
          ...marketSnapshot(simulatedFinalMarket),
          borrowAmount: scaledRequestedLiquidity,
        },
      },
      sourceMarkets,
    };

    if (withdrawals.totalReallocated > 0n) {
      const liquidityShortfall = MathLib.zeroFloorSub(
        scaledRequestedLiquidity,
        result.currentMarketLiquidity + withdrawals.totalReallocated
      );

      result.reallocation = {
        withdrawals,
        liquidityNeededFromReallocation:
          targetUtilization === 0n
            ? MathLib.MAX_UINT_160
            : MathLib.zeroFloorSub(
                MathLib.wDivDown(
                  initialMarket.totalBorrowAssets + scaledRequestedLiquidity,
                  targetUtilization
                ),
                initialMarket.totalSupplyAssets
              ),
        reallocatableLiquidity: withdrawals.totalReallocated,
        isLiquidityFullyMatched: liquidityShortfall === 0n,
        liquidityShortfall,
      };
    }

    result.reason = {
      type: "success",
      message:
        withdrawals.totalReallocated > 0n
          ? "Successfully simulated with morpho-sdk public allocator reallocation"
          : "Successfully simulated without reallocation",
    };

    return result;
  } catch (error) {
    console.error("Error in fetchMarketSimulationBorrow:", error);
    return {
      ...result,
      reason: {
        type: "error",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
    };
  }
}

export async function fetchMarketSimulationSeries(
  marketId: MarketId,
  chainId: number
): Promise<{
  percentages: number[];
  initialLiquidity: bigint;
  utilizationSeries: number[];
  apySeries: number[];
  borrowAmounts: bigint[];
  error?: string;
}> {
  try {
    const [
      { client, loader },
      {
        supplyTargetUtilization,
        maxWithdrawalUtilization,
        reallocatableVaults,
      },
      apiMetrics,
    ] = await Promise.all([
      initializeClientAndLoader(chainId),
      fetchMarketTargets(chainId),
      fetchMarketMetricsFromAPI(marketId, chainId),
    ]);
    const block = await getBlock(client);

    const { rpcData } = await fetchMarketData(loader, marketId);

    if (!rpcData || !rpcData.startState) {
      return {
        percentages: [],
        initialLiquidity: BigInt(0),
        utilizationSeries: [],
        apySeries: [],
        borrowAmounts: [],
        error: "Market does not exist or cannot be found on this chain",
      };
    }

    const startState = rpcData.startState;
    const initialMarket = startState.getMarket(marketId);

    if (!initialMarket || !initialMarket.params) {
      return {
        percentages: [],
        initialLiquidity: BigInt(0),
        utilizationSeries: [],
        apySeries: [],
        borrowAmounts: [],
        error: "Invalid market data returned from chain",
      };
    }

    const targetOverrides = mergeApiMarketTargets(
      marketId,
      apiMetrics,
      supplyTargetUtilization,
      maxWithdrawalUtilization
    );

    // Define percentage steps with more granularity (every 5% instead of 1% to reduce RPC calls)
    const percentages = Array.from({ length: 21 }, (_, i) => i * 5); // 0, 5, 10, 15, ..., 100
    const maxLiquidity =
      initialMarket.liquidity +
      rpcData.withdrawals.reduce(
        (sum, withdrawal) => sum + withdrawal.assets,
        0n
      );
    const utilizationSeries: number[] = [];
    const apySeries: number[] = [];
    const borrowAmounts: bigint[] = [];
    const reallocationTimestamp = block.timestamp + REALLOCATION_SIMULATION_DELAY;

    let hasLoggedSimulationError = false;

    for (const percentage of percentages) {
      const borrowAmount = (maxLiquidity * BigInt(percentage)) / 100n;
      borrowAmounts.push(borrowAmount);

      if (borrowAmount === 0n) {
        utilizationSeries.push(
          Number(formatUnits(initialMarket.utilization, 16))
        );
        apySeries.push(Number(formatUnits(toWadBigInt(initialMarket.borrowApy), 16)));
        continue;
      }

      try {
        const reallocations = computeReallocations({
          reallocationData: startState,
          marketId,
          operation: "borrow",
          amount: borrowAmount,
          options: {
            enabled: true,
            timestamp: reallocationTimestamp,
            defaultSupplyTargetUtilization: DEFAULT_SUPPLY_TARGET_UTILIZATION,
            supplyTargetUtilization: targetOverrides.supplyTargetUtilization,
            maxWithdrawalUtilization: targetOverrides.maxWithdrawalUtilization,
            reallocatableVaults,
          },
        });

        const reallocatedAmount = getTotalReallocated(reallocations);
        const marketBeforeBorrow = applySupply(
          initialMarket,
          reallocatedAmount,
          reallocationTimestamp
        );
        const simulatedMarket = applyBorrow(
          marketBeforeBorrow,
          borrowAmount,
          reallocationTimestamp
        );

        utilizationSeries.push(
          Number(formatUnits(simulatedMarket.utilization, 16))
        );
        apySeries.push(Number(formatUnits(toWadBigInt(simulatedMarket.borrowApy), 16)));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (!hasLoggedSimulationError) {
          console.error(`❌ [SIMULATION ERROR] Error at ${percentage}%: ${errorMessage}`);
          console.error(`   Market: ${marketId}`);
          console.error(`   Borrow amount: ${borrowAmount.toString()}`);
          console.error(`   Market liquidity: ${initialMarket.liquidity.toString()}`);
          hasLoggedSimulationError = true;
        }

        // Use previous values or defaults if simulation fails
        utilizationSeries.push(
          utilizationSeries[utilizationSeries.length - 1] || 0
        );
        apySeries.push(apySeries[apySeries.length - 1] || 0);
      }
    }

    return {
      percentages,
      initialLiquidity: maxLiquidity,
      utilizationSeries,
      apySeries,
      borrowAmounts,
    };
  } catch (error) {
    console.error("Error in fetchMarketSimulationSeries:", error);
    return {
      percentages: [],
      initialLiquidity: BigInt(0),
      utilizationSeries: [],
      apySeries: [],
      borrowAmounts: [],
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

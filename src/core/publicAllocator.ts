// WIP work, do not change this file.

import {
    DEFAULT_SLIPPAGE_TOLERANCE,
    getChainAddresses,
    Holding,
    Market,
    MarketId,
    MarketParams,
    MathLib,
    NATIVE_ADDRESS,
    Position,
    User
} from "@morpho-org/blue-sdk";
import "@morpho-org/blue-sdk-viem/lib/augment";
import {
    InputBundlerOperation,
    populateBundle,
    simulateBundlerOperations
} from "@morpho-org/bundler-sdk-viem";
import { LiquidityLoader } from "@morpho-org/liquidity-sdk-viem";
import { getLast, values } from "@morpho-org/morpho-ts";
import {
    produceImmutable,
    type SimulationState
} from "@morpho-org/simulation-sdk";
import {
    Address,
    createClient,
    formatUnits,
    maxUint256,
    parseEther
} from "viem";
import { getChainConfig } from "../config/chains";
import { TARGET_UTILIZATION } from "../config/constants";
import { fetchMarketTargets } from "../fetchers/fetchApiTargets";
import { createProxyTransport } from "../utils/client";
/**
 * The default target utilization above which the shared liquidity algorithm is triggered (scaled by WAD).
 */
export const DEFAULT_SUPPLY_TARGET_UTILIZATION = TARGET_UTILIZATION;

/**
 * Helper function to convert a number (decimal APY) to WAD-scaled bigint.
 * The new SDK returns APYs as numbers (e.g., 0.05 for 5%), we need to convert to WAD scale.
 */
function toWadBigInt(value: number | bigint | undefined): bigint {
  if (value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  return BigInt(Math.floor(value * 1e18));
}

/**
 * Helper function to create a holding object that matches the IHolding interface
 */
function createHolding(
  user: Address,
  token: Address,
  balance: bigint,
  options: {
    morphoAllowance?: bigint;
    permit2Allowance?: bigint;
    bundlerAllowance?: bigint;
    permit2BundlerAmount?: bigint;
    permit2BundlerExpiration?: bigint;
    permit2BundlerNonce?: bigint;
  } = {}
): Holding {
  return new Holding({
    user,
    token,
    balance,
    erc20Allowances: {
      morpho: options.morphoAllowance ?? maxUint256,
      permit2: options.permit2Allowance ?? maxUint256,
      "bundler3.generalAdapter1": options.bundlerAllowance ?? maxUint256,
    },
    permit2BundlerAllowance: {
      amount: options.permit2BundlerAmount ?? maxUint256,
      expiration: options.permit2BundlerExpiration ?? BigInt(2 ** 48 - 1),
      nonce: options.permit2BundlerNonce ?? 0n,
    },
  });
}

/**
 * Helper function to create a native token holding
 */
function createNativeHolding(user: Address, balance: bigint): Holding {
  return createHolding(user, NATIVE_ADDRESS, balance);
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

const SIMULATION_USER_ADDRESS: Address = "0x7f7A70b5B584C4033CAfD52219a496Df9AFb1af7";
const DEALT_AMOUNT = MathLib.MAX_UINT_160;

function createUser(address: Address, isBundlerAuthorized = false): User {
  return new User({
    address,
    isBundlerAuthorized,
    morphoNonce: 0n,
  });
}

function createPosition(user: Address, marketId: MarketId): Position {
  return new Position({
    user,
    marketId,
    supplyShares: 0n,
    borrowShares: 0n,
    collateral: 0n,
  });
}

/**
 * Seed the same minimum bundler-side simulation state vvrm-app relies on.
 * LiquidityLoader provides markets/vaults/flow caps; this fills the synthetic
 * user and bundler holdings needed to run a potential borrow through the SDK.
 */
function seedBundlerState(state: SimulationState): SimulationState {
  const { bundler3 } = getChainAddresses(state.chainId);

  state.users[bundler3.generalAdapter1] ??= createUser(bundler3.generalAdapter1);

  for (const token of values(state.tokens)) {
    if (!token) continue;

    (state.holdings[bundler3.generalAdapter1] ??= {})[token.address] ??=
      createHolding(bundler3.generalAdapter1, token.address, 0n);
  }

  (state.holdings[bundler3.generalAdapter1] ??= {})[NATIVE_ADDRESS] ??=
    createNativeHolding(bundler3.generalAdapter1, 0n);

  (state.holdings[bundler3.bundler3] ??= {})[NATIVE_ADDRESS] ??= createNativeHolding(
    bundler3.bundler3,
    0n
  );

  for (const market of values(state.markets)) {
    if (!market) continue;

    (state.positions[bundler3.generalAdapter1] ??= {})[market.id] ??= createPosition(
      bundler3.generalAdapter1,
      market.id
    );
  }

  return state;
}

function seedPotentialBorrowState(
  state: SimulationState,
  userAddress: Address = SIMULATION_USER_ADDRESS
): SimulationState {
  return seedBundlerState(
    produceImmutable(state, (draft) => {
      const { bundler3 } = getChainAddresses(draft.chainId);

      draft.users[userAddress] ??= createUser(userAddress);

      for (const token of values(draft.tokens)) {
        if (!token) continue;

        const holding = ((draft.holdings[userAddress] ??= {})[token.address] ??=
          createHolding(userAddress, token.address, 0n));
        holding.canTransfer = true;
        holding.balance += DEALT_AMOUNT;
      }

      (draft.holdings[userAddress] ??= {})[NATIVE_ADDRESS] ??= createNativeHolding(
        userAddress,
        maxUint256
      );

      for (const market of values(draft.markets)) {
        if (!market) continue;

        (draft.positions[userAddress] ??= {})[market.id] ??= createPosition(
          userAddress,
          market.id
        );

        for (const token of [market.params.loanToken, market.params.collateralToken]) {
          const userHolding = ((draft.holdings[userAddress] ??= {})[token] ??=
            createHolding(userAddress, token, 0n));
          userHolding.canTransfer = true;
          userHolding.balance = maxUint256;

          (draft.holdings[bundler3.generalAdapter1] ??= {})[token] ??= createHolding(
            bundler3.generalAdapter1,
            token,
            maxUint256
          );
          (draft.holdings[bundler3.bundler3] ??= {})[token] ??= createHolding(
            bundler3.bundler3,
            token,
            maxUint256
          );
        }
      }
    })
  );
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

function getReallocatedAmount(operations: ReturnType<typeof populateBundle>["operations"]) {
  return operations
    .filter((op) => op.type === "MetaMorpho_PublicReallocate")
    .reduce(
      (acc, op) =>
        acc + op.args.withdrawals.reduce((sum, withdrawal) => sum + withdrawal.assets, 0n),
      0n
    );
}

function getStateBeforeBorrow(
  operations: ReturnType<typeof populateBundle>["operations"],
  startState: SimulationState,
  marketId: MarketId
) {
  const borrowOperationIndex = operations.findIndex(
    (op) => op.type === "Blue_Borrow" && op.args.id === marketId
  );

  if (borrowOperationIndex < 0) return startState;
  const preBorrowOperations = operations.slice(0, borrowOperationIndex);
  if (preBorrowOperations.length === 0) return startState;

  return getLast(simulateBundlerOperations(preBorrowOperations, startState));
}

function getWithdrawalsPerVault(
  operations: ReturnType<typeof populateBundle>["operations"],
  startState: SimulationState
): ProcessedWithdrawals {
  const withdrawalsPerVault: ProcessedWithdrawals["withdrawalsPerVault"] = {};
  let totalReallocated = 0n;

  for (const operation of operations) {
    if (operation.type !== "MetaMorpho_PublicReallocate") continue;

    const vaultWithdrawals = (withdrawalsPerVault[operation.address] ??= []);
    for (const withdrawal of operation.args.withdrawals) {
      const sourceMarket = startState.getMarket(withdrawal.id);
      vaultWithdrawals.push({
        marketId: withdrawal.id,
        marketParams: sourceMarket.params,
        amount: withdrawal.assets,
        sourceMarketLiquidity: sourceMarket.liquidity,
      });
      totalReallocated += withdrawal.assets;
    }
  }

  return { withdrawalsPerVault, totalReallocated };
}

// Backward-compatible legacy entrypoint. The implementation now uses the same
// SDK-populated public allocator path as the market simulation dashboard.
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
    const userAddress: Address = "0x7f7A70b5B584C4033CAfD52219a496Df9AFb1af7";

    // Initialize client, loader and fetch market targets
    const { client, loader } = await initializeClientAndLoader(chainId);
    const {
      supplyTargetUtilization,
      maxWithdrawalUtilization,
      reallocatableVaults,
    } = await fetchMarketTargets(chainId);

    // Fetch API metrics and market data
    const [apiMetrics, market] = await Promise.all([
      fetchMarketMetricsFromAPI(marketId, chainId),
      Market.fetch(marketId, client),
    ]);

    result.apiMetrics = apiMetrics;
    result.currentMarketLiquidity = market.liquidity;

    // Check if we can fetch market data
    const { rpcData } = await fetchMarketData(loader, marketId);

    if (!rpcData || !rpcData.startState) {
      result.reason = {
        type: "error",
        message: "Market data unavailable",
      };
      return result;
    }

    const startState = seedPotentialBorrowState(rpcData.startState, userAddress);
    const initialMarket = startState.getMarket(marketId);

    // Validate that the market exists and has required data
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

    // Mirror vvrm-app: model the user's requested borrow and let the bundler SDK
    // insert MetaMorpho_PublicReallocate operations if target utilization requires it.
    const operations: InputBundlerOperation[] = [
      {
        type: "Blue_SupplyCollateral",
        sender: userAddress,
        args: {
          id: marketId,
          assets: maxUint256 / 2n,
          onBehalf: userAddress,
        },
      },
      {
        type: "Blue_Borrow",
        sender: userAddress,
        args: {
          id: marketId,
          assets: scaledRequestedLiquidity,
          onBehalf: userAddress,
          receiver: userAddress,
          slippage: DEFAULT_SLIPPAGE_TOLERANCE,
        },
      },
    ];

    const populatedBundle = populateBundle(operations, startState, {
      publicAllocatorOptions: {
        enabled: true,
        defaultSupplyTargetUtilization: DEFAULT_SUPPLY_TARGET_UTILIZATION,
        supplyTargetUtilization: targetOverrides.supplyTargetUtilization,
        maxWithdrawalUtilization: targetOverrides.maxWithdrawalUtilization,
        reallocatableVaults,
      },
    });

    const reallocatedAmountFromBundle = getReallocatedAmount(populatedBundle.operations);
    const finalState = getLast(populatedBundle.steps);
    const stateBeforeBorrow = getStateBeforeBorrow(
      populatedBundle.operations,
      startState,
      marketId
    );

    const marketBeforeBorrow = stateBeforeBorrow.getMarket(marketId);
    const simulatedFinalMarket = finalState.getMarket(marketId);
    const withdrawals = getWithdrawalsPerVault(populatedBundle.operations, startState);

    const sourceMarkets: { [marketId: string]: MarketSimulationResult } = {};
    for (const vaultWithdrawals of Object.values(withdrawals.withdrawalsPerVault)) {
      for (const withdrawal of vaultWithdrawals) {
        const sourceMarketInitial = startState.getMarket(withdrawal.marketId);
        const sourceMarketAfterReallocation = stateBeforeBorrow.getMarket(withdrawal.marketId);

        sourceMarkets[withdrawal.marketId] = {
          preReallocation: {
            liquidity: sourceMarketInitial.liquidity,
            borrowApy: toWadBigInt(sourceMarketInitial.borrowApy),
            utilization: sourceMarketInitial.utilization,
          },
          postReallocation: {
            liquidity: sourceMarketAfterReallocation.liquidity,
            borrowApy: toWadBigInt(sourceMarketAfterReallocation.borrowApy),
            reallocatedAmount: withdrawal.amount,
            utilization: sourceMarketAfterReallocation.utilization,
          },
        };
      }
    }

    result.simulation = {
      targetMarket: {
        preReallocation: {
          liquidity: initialMarket.liquidity,
          borrowApy: toWadBigInt(initialMarket.borrowApy),
          utilization: initialMarket.utilization,
        },
        postReallocation: {
          liquidity: marketBeforeBorrow.liquidity,
          borrowApy: toWadBigInt(marketBeforeBorrow.borrowApy),
          reallocatedAmount: reallocatedAmountFromBundle,
          utilization: marketBeforeBorrow.utilization,
        },
        postBorrow: {
          liquidity: simulatedFinalMarket.liquidity,
          borrowApy: toWadBigInt(simulatedFinalMarket.borrowApy),
          borrowAmount: scaledRequestedLiquidity,
          utilization: simulatedFinalMarket.utilization,
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
          ? "Successfully simulated with SDK-populated public allocator reallocation"
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
    const userAddress: Address = SIMULATION_USER_ADDRESS;
    const [
      { loader },
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

    // First, check if we can fetch market data
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

    const startState = seedPotentialBorrowState(rpcData.startState, userAddress);
    const initialMarket = startState.getMarket(marketId);

    // Validate that the market exists and has required data
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
    const vaultAddresses = [...new Set(rpcData.withdrawals.map((w) => w.vault))];

    // Define percentage steps with more granularity (every 5% instead of 1% to reduce RPC calls)
    const percentages = Array.from({ length: 21 }, (_, i) => i * 5); // 0, 5, 10, 15, ..., 100
    const maxLiquidity =
      initialMarket.liquidity +
      rpcData.withdrawals.reduce(
        (sum, withdrawal) => sum + withdrawal.assets,
        0n
      );
    // Store results
    const utilizationSeries: number[] = [];
    const apySeries: number[] = [];
    const borrowAmounts: bigint[] = [];

    // Track if we've already logged a simulation error (to avoid console noise)
    let hasLoggedSimulationError = false;

    // Run simulations for each percentage. This is intentionally PA-aware: the
    // graph shows the user's effective borrow APY after potential reallocation,
    // so it stays near target until the allocator liquidity is exhausted, then
    // follows the upper IRM curve.
    for (const percentage of percentages) {
      const borrowAmount = (maxLiquidity * BigInt(percentage)) / 100n;
      borrowAmounts.push(borrowAmount);

      // Handle 0% case: use current market state without simulation
      // (SDK throws "inconsistent input" error when borrowing 0 assets)
      if (borrowAmount === 0n) {
        utilizationSeries.push(
          Number(formatUnits(initialMarket.utilization, 16))
        );
        apySeries.push(Number(formatUnits(toWadBigInt(initialMarket.borrowApy), 16)));
        continue;
      }

      // Create operations for this borrowAmount
      const operations: InputBundlerOperation[] = [
        {
          type: "Blue_SupplyCollateral",
          sender: userAddress,
          args: {
            id: marketId,
            assets: maxUint256 / 2n,
            onBehalf: userAddress,
          },
        },
        {
          type: "Blue_Borrow",
          sender: userAddress,
          args: {
            id: marketId,
            assets: borrowAmount,
            onBehalf: userAddress,
            receiver: userAddress,
            slippage: DEFAULT_SLIPPAGE_TOLERANCE,
          },
        },
      ];

      try {
        // Simulate operations with the fetched API targets.
        const { steps } = populateBundle(operations, startState, {
          publicAllocatorOptions: {
            enabled: true,
            defaultSupplyTargetUtilization: DEFAULT_SUPPLY_TARGET_UTILIZATION,
            supplyTargetUtilization: targetOverrides.supplyTargetUtilization,
            maxWithdrawalUtilization: targetOverrides.maxWithdrawalUtilization,
            reallocatableVaults,
          },
        });

        // Get final state
        const finalState = getLast(steps);
        const simulatedMarket = finalState.getMarket(marketId);

        // Store utilization and APY values (as percentages)
        utilizationSeries.push(
          Number(formatUnits(simulatedMarket.utilization, 16))
        );
        apySeries.push(Number(formatUnits(toWadBigInt(simulatedMarket.borrowApy), 16)));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (!hasLoggedSimulationError) {
          // Log the first simulation error with context, then suppress subsequent ones
          console.error(`❌ [SIMULATION ERROR] Error at ${percentage}%: ${errorMessage}`);
          console.error(`   Market: ${marketId}`);
          console.error(`   Borrow amount: ${borrowAmount.toString()}`);
          console.error(`   Market liquidity: ${initialMarket.liquidity.toString()}`);
          console.error(`   Available vaults: ${vaultAddresses.length > 0 ? vaultAddresses.join(', ') : 'none'}`);
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

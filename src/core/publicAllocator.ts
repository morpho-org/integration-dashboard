// WIP work, do not change this file.

import {
  DEFAULT_SLIPPAGE_TOLERANCE,
  getChainAddresses,
  Market,
  MarketId,
  MarketParams,
  MarketUtils,
  MathLib,
} from "@morpho-org/blue-sdk";
import "@morpho-org/blue-sdk-viem/lib/augment";
import {
  InputBundlerOperation,
  populateBundle,
} from "@morpho-org/bundler-sdk-viem";
import { LiquidityLoader } from "@morpho-org/liquidity-sdk-viem";
import { BundlerAction } from "@morpho-org/morpho-blue-bundlers/pkg";
import { BaseBundlerV2__factory } from "@morpho-org/morpho-blue-bundlers/types";
import { getLast, Time } from "@morpho-org/morpho-ts";
import {
  type MaybeDraft,
  type SimulationState,
  produceImmutable,
  PublicReallocation,
} from "@morpho-org/simulation-sdk";
import {
  Address,
  createClient,
  formatUnits,
  http,
  maxUint256,
  parseEther,
} from "viem";
import { base, mainnet, polygon, unichain } from "viem/chains";
import { fetchMarketTargets } from "../fetchers/fetchApiTargets";
/**
 * The default target utilization above which the shared liquidity algorithm is triggered (scaled by WAD).
 */
export const DEFAULT_SUPPLY_TARGET_UTILIZATION = 90_5000000000000000n;

export interface VaultReallocation {
  id: MarketId;
  assets: bigint;
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
  marketByUniqueKey(uniqueKey: $uniqueKey, chainId: $chainId) {
    reallocatableLiquidityAssets
    publicAllocatorSharedLiquidity {
      assets
      vault {
        address
        name
      }
      allocationMarket {
        targetBorrowUtilization
        targetWithdrawUtilization
        state {
          utilization
          supplyAssets
          borrowAssets
        } 
        uniqueKey
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

async function initializeClientAndLoader(chainId: number) {
  // Use the appropriate RPC URL based on chain ID
  const rpcUrl =
    chainId === 1
      ? process.env.REACT_APP_RPC_URL_MAINNET
      : chainId === 8453
      ? process.env.REACT_APP_RPC_URL_BASE
      : chainId === 137
      ? process.env.REACT_APP_RPC_URL_POLYGON
      : chainId === 130
      ? process.env.REACT_APP_RPC_URL_UNICHAIN
      : undefined;

  if (!rpcUrl)
    throw new Error(`No RPC URL configured for chain ID: ${chainId}`);

  const client = createClient({
    chain: chainId === 1 ? mainnet : chainId === 8453 ? base : chainId === 137 ? polygon : chainId === 130 ? unichain : mainnet,
    transport: http(rpcUrl, {
      retryCount: 3,
      retryDelay: 2000,
      timeout: 20000,
      batch: {
        // Only useful for Alchemy endpoints
        batchSize: 100,
        wait: 20,
      },
    }),
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

async function fetchMarketMetricsFromAPI(marketId: MarketId, chainId: number) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: MARKET_QUERY,
      variables: { uniqueKey: marketId, chainId },
    }),
  });

  const data: any = await response.json();
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
    lltv: marketData.lltv,
    publicAllocatorSharedLiquidity:
      marketData.publicAllocatorSharedLiquidity.map((item: any) => ({
        assets: item.assets,
        vault: item.vault,
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

function processReallocations(
  withdrawals: PublicReallocation[],
  requiredAssets: bigint
): { [vault: Address]: VaultReallocation[] } {
  const reallocations: { [vault: Address]: VaultReallocation[] } = {};

  for (const { vault, id, assets } of withdrawals) {
    // Initialize array for this vault if it doesn't exist
    if (!reallocations[vault]) {
      reallocations[vault] = [];
    }

    if (assets > requiredAssets) {
      // If this withdrawal can fulfill all remaining required assets
      reallocations[vault].push({
        id,
        assets: requiredAssets,
      });
      break;
    } else {
      // Add the full withdrawal amount and continue
      reallocations[vault].push({
        id,
        assets,
      });
      requiredAssets -= assets;
    }
  }

  return reallocations;
}

function simulateMarketStates(
  rpcData: {
    startState: SimulationState;
    endState: MaybeDraft<SimulationState>;
    withdrawals: PublicReallocation[];
    targetBorrowUtilization: bigint;
  },
  marketId: MarketId,
  requestedLiquidity: bigint,
  reallocations: { [vault: Address]: VaultReallocation[] }
): SimulationResults {
  // Create a new simulation state based on initial state
  const simulatedState = produceImmutable(rpcData.startState, (draft) => {
    // Process each reallocation

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [vault, vaultReallocations] of Object.entries(reallocations)) {
      for (const reallocation of vaultReallocations) {
        // Get source market
        const sourceMarket = draft.getMarket(reallocation.id);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const initialSourceState = {
          liquidity: sourceMarket.liquidity,
          borrowApy: sourceMarket.borrowApy,
          utilization: sourceMarket.utilization,
        };

        // Simulate withdrawal and capture new state
        const withdrawResult = sourceMarket.withdraw(reallocation.assets, 0n);

        // Replace market properties with new state
        Object.assign(sourceMarket, withdrawResult.market);

        // Get target market and track initial state
        const targetMarket = draft.getMarket(marketId);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const initialTargetState = {
          liquidity: targetMarket.liquidity,
          borrowApy: targetMarket.borrowApy,
          utilization: targetMarket.utilization,
        };

        // Simulate deposit and capture new state
        const supplyResult = targetMarket.supply(reallocation.assets, 0n);

        // Replace market properties with new state
        Object.assign(targetMarket, supplyResult.market);
      }
    }
  });

  // Get initial and final states for target market
  const marketInitial = rpcData.startState.getMarket(marketId);
  const marketPostReallocationSimulated = simulatedState.getMarket(marketId);
  const reallocatedAmount =
    marketPostReallocationSimulated.liquidity - marketInitial.liquidity;

  // Simulate borrow impact
  const borrowAmount = MathLib.min(
    requestedLiquidity,
    marketPostReallocationSimulated.liquidity
  );
  const borrowResult = marketPostReallocationSimulated.borrow(
    borrowAmount,
    0n,
    Time.timestamp()
  );

  // Update market with borrow result
  const marketPostBorrow = borrowResult.market;

  // Calculate metrics for source markets
  const sourceMarkets: { [marketId: string]: MarketSimulationResult } = {};
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const [vault, vaultReallocations] of Object.entries(reallocations)) {
    for (const reallocation of vaultReallocations) {
      const sourceMarketInitial = rpcData.startState.getMarket(reallocation.id);
      const sourceMarketSimulated = simulatedState.getMarket(reallocation.id);

      sourceMarkets[reallocation.id] = {
        preReallocation: {
          liquidity: sourceMarketInitial.liquidity,
          borrowApy: sourceMarketInitial.borrowApy,
          utilization: sourceMarketInitial.utilization,
        },
        postReallocation: {
          liquidity: sourceMarketSimulated.liquidity,
          borrowApy: sourceMarketSimulated.borrowApy,
          reallocatedAmount: reallocation.assets,
          utilization: sourceMarketSimulated.utilization,
        },
      };
    }
  }

  return {
    targetMarket: {
      preReallocation: {
        liquidity: marketInitial.liquidity,
        borrowApy: marketInitial.borrowApy,
        utilization: marketInitial.utilization,
      },
      postReallocation: {
        liquidity: marketPostReallocationSimulated.liquidity,
        borrowApy: marketPostReallocationSimulated.borrowApy,
        reallocatedAmount,
        utilization: marketPostReallocationSimulated.utilization,
      },
      postBorrow: {
        liquidity: marketPostBorrow.liquidity,
        borrowApy: marketPostBorrow.borrowApy,
        borrowAmount,
        utilization: marketPostBorrow.utilization,
      },
    },
    sourceMarkets,
  };
}

// legacy function. Keeping for few weeks starting 9 April 2025 for reference.
export async function compareAndReallocate(
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

  const { client, config, loader } = await initializeClientAndLoader(chainId);

  try {
    // First fetch API metrics to get decimals
    const [apiMetrics, market] = await Promise.all([
      fetchMarketMetricsFromAPI(marketId, chainId),
      Market.fetch(marketId, client),
    ]);

    result.apiMetrics = apiMetrics;
    result.currentMarketLiquidity = market.liquidity;

    // Scale the requested liquidity with the correct decimals
    const scaledRequestedLiquidity =
      requestedLiquidity * BigInt(10 ** apiMetrics.decimals);

    const supplyTargetUtilization = DEFAULT_SUPPLY_TARGET_UTILIZATION;
    const newTotalSupplyAssets = market.totalSupplyAssets;
    const newTotalBorrowAssets =
      market.totalBorrowAssets + scaledRequestedLiquidity;

    // Then the maximum additional borrow, to keep utilization ≤ supplyTargetUtilization:
    const maxAdditionalBorrow =
      MathLib.wMulUp(supplyTargetUtilization, newTotalSupplyAssets) -
      market.totalBorrowAssets;
    result.apiMetrics.maxBorrowWithoutReallocation = maxAdditionalBorrow;

    const needsReallocation =
      MarketUtils.getUtilization({
        totalSupplyAssets: newTotalSupplyAssets,
        totalBorrowAssets: newTotalBorrowAssets,
      }) > supplyTargetUtilization;

    // Simulate borrow impact without reallocation
    const borrowAmount = MathLib.min(
      scaledRequestedLiquidity,
      market.liquidity
    );

    const targetMarketBorrowSimulated = market.borrow(
      borrowAmount,
      0n,
      Time.timestamp()
    );

    if (needsReallocation) {
      // Calculate required assets for target utilization
      let requiredAssets =
        MathLib.wDivDown(newTotalBorrowAssets, supplyTargetUtilization) -
        newTotalSupplyAssets;

      const { rpcData, hasReallocatableLiquidity } = await fetchMarketData(
        loader,
        marketId
      );

      if (hasReallocatableLiquidity) {
        const reallocations = processReallocations(
          rpcData.withdrawals,
          requiredAssets
        );

        result.simulation = simulateMarketStates(
          rpcData,
          marketId,
          scaledRequestedLiquidity,
          reallocations
        );

        // Calculate total reallocated liquidity
        const totalReallocated = Object.values(reallocations).reduce(
          (total, vaultReallocations) =>
            total + vaultReallocations.reduce((sum, r) => sum + r.assets, 0n),
          0n
        );

        const isLiquidityFullyMatched =
          result.currentMarketLiquidity + totalReallocated >=
          scaledRequestedLiquidity;

        // Transform reallocations into withdrawal details
        const withdrawalsPerVault: {
          [vaultAddress: string]: WithdrawalDetails[];
        } = {};

        for (const [vault, vaultReallocations] of Object.entries(
          reallocations
        )) {
          withdrawalsPerVault[vault] = vaultReallocations.map(
            (reallocation) => ({
              marketId: reallocation.id,
              marketParams: MarketParams.get(reallocation.id),
              amount: reallocation.assets,
              sourceMarketLiquidity: rpcData.startState.getMarket(
                reallocation.id
              ).liquidity,
            })
          );
        }

        result.reallocation = {
          withdrawals: {
            withdrawalsPerVault,
            totalReallocated,
          },
          liquidityNeededFromReallocation: requiredAssets,
          reallocatableLiquidity: totalReallocated,
          isLiquidityFullyMatched,
          liquidityShortfall: isLiquidityFullyMatched
            ? 0n
            : scaledRequestedLiquidity -
              (result.currentMarketLiquidity + totalReallocated),
        };

        // Generate raw transaction if we have reallocations
        if (result.reallocation.withdrawals.totalReallocated > 0n) {
          const supplyMarketParams = MarketParams.get(marketId);

          // Sort withdrawals by market id for consistency
          const filteredVaults = Object.keys(withdrawalsPerVault).filter(
            (vaultAddress) =>
              withdrawalsPerVault[vaultAddress].length > 0 &&
              withdrawalsPerVault[vaultAddress].map(
                (withdrawal) => withdrawal.amount > 0n
              )
          );

          const multicallActions = filteredVaults.map((vaultAddress) => {
            const vaultWithdrawals = withdrawalsPerVault[vaultAddress];
            // Sort withdrawals within each vault
            vaultWithdrawals.sort((a, b) => (a.marketId > b.marketId ? 1 : -1));

            return BundlerAction.metaMorphoReallocateTo(
              config.publicAllocator as `0x${string}`,
              vaultAddress,
              0n, // No fee for now
              vaultWithdrawals,
              supplyMarketParams
            );
          });

          result.rawTransaction = {
            to: config.bundler3.bundler3 as `0x${string}`,
            data: BaseBundlerV2__factory.createInterface().encodeFunctionData(
              "multicall",
              [multicallActions]
            ),
            value: "0",
          };
        }

        if (!isLiquidityFullyMatched) {
          result.reason = {
            type: "error",
            message:
              "Unable to fully match requested liquidity with available reallocations",
          };
        } else {
          result.reason = {
            type: "success",
            message: "Successfully generated reallocation transaction",
          };
        }
      } else {
        result.reason = {
          type: "error",
          message: "No onchain reallocatable liquidity available at the moment",
        };
      }
    } else {
      // Add simulation results even when no reallocation is needed
      result.simulation = {
        targetMarket: {
          preReallocation: {
            liquidity: market.liquidity,
            borrowApy: market.borrowApy,
            utilization: market.utilization,
          },
          postReallocation: {
            liquidity: market.liquidity,
            borrowApy: market.borrowApy,
            reallocatedAmount: 0n,
            utilization: market.utilization,
          },
          postBorrow: {
            liquidity: targetMarketBorrowSimulated.market.liquidity,
            borrowApy: targetMarketBorrowSimulated.market.borrowApy,
            borrowAmount,
            utilization: targetMarketBorrowSimulated.market.utilization,
          },
        },
        sourceMarkets: {},
      };

      result.reason = {
        type: "success",
        message:
          "Sufficient liquidity already available in the market, no reallocation needed",
      };
    }

    return result;
  } catch (error) {
    console.error("Error in compareAndReallocate:", error);
    throw error;
  }
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

    const startState = rpcData.startState;
    const initialMarket = startState.getMarket(marketId);

    // Validate that the market exists and has required data
    if (!initialMarket || !initialMarket.params) {
      result.reason = {
        type: "error",
        message: "Invalid market data",
      };
      return result;
    }

    const { morpho } = getChainAddresses(chainId);

    // Initialize user position for this market
    if (!startState.users[userAddress]) {
      startState.users[userAddress] = {
        address: userAddress,
        isBundlerAuthorized: false,
        morphoNonce: 0n,
      };
    }

    // Initialize user position for this market
    if (!startState.positions[userAddress]) {
      startState.positions[userAddress] = {};
    }

    // Add an empty position for this market
    startState.positions[userAddress][marketId] = {
      supplyShares: 0n,
      borrowShares: 0n,
      collateral: 0n,
      user: userAddress,
      marketId: marketId,
    };

    // Prepare user holdings for simulation
    if (!startState.holdings[userAddress]) {
      startState.holdings[userAddress] = {};
    }

    // Add collateral token to user's holdings
    startState.holdings[userAddress][initialMarket.params.collateralToken] = {
      balance: maxUint256 / 2n,
      user: userAddress,
      token: initialMarket.params.collateralToken,
      erc20Allowances: {
        morpho: maxUint256,
        permit2: 0n,
        "bundler3.generalAdapter1": maxUint256,
      },
      permit2BundlerAllowance: {
        amount: 0n,
        expiration: 0n,
        nonce: 0n,
      },
    };

    // Add native token holding for user (needed for gas fees)
    startState.holdings[userAddress]["0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"] = {
      balance: maxUint256,
      user: userAddress,
      token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      erc20Allowances: {
        morpho: maxUint256,
        permit2: maxUint256,
        "bundler3.generalAdapter1": maxUint256,
      },
      permit2BundlerAllowance: {
        amount: maxUint256,
        expiration: BigInt(2 ** 48 - 1),
        nonce: 0n,
      },
    };

    // Get bundler addresses
    const bundlerAddresses = getChainAddresses(chainId);
    const bundlerGeneralAdapter = bundlerAddresses.bundler3.generalAdapter1;
    const bundlerBundler3 = bundlerAddresses.bundler3.bundler3;
    
    // Debug: Check if bundler addresses are properly defined
    console.log(`🔍 [BUNDLER ADDRESSES DEBUG] bundlerAddresses:`, bundlerAddresses);
    console.log(`🔍 [BUNDLER ADDRESSES DEBUG] bundlerGeneralAdapter:`, bundlerGeneralAdapter);
    console.log(`🔍 [BUNDLER ADDRESSES DEBUG] bundlerBundler3:`, bundlerBundler3);
    
    // Safety check: ensure bundlerBundler3 is defined
    if (!bundlerBundler3) {
      console.error(`❌ [BUNDLER ERROR] bundlerBundler3 is undefined! bundlerAddresses:`, bundlerAddresses);
      throw new Error(`bundlerBundler3 address is undefined for chainId ${chainId}`);
    }

    // Initialize bundler adapter holding for the collateral token
    if (!startState.holdings[bundlerGeneralAdapter]) {
      startState.holdings[bundlerGeneralAdapter] = {};
    }

    // Add the collateral token to the bundler's holdings
    startState.holdings[bundlerGeneralAdapter][
      initialMarket.params.collateralToken
    ] = {
      balance: maxUint256, // Very large balance
      user: bundlerGeneralAdapter,
      token: initialMarket.params.collateralToken,
      erc20Allowances: {
        morpho: maxUint256,
        permit2: maxUint256,
        "bundler3.generalAdapter1": maxUint256,
      },
      permit2BundlerAllowance: {
        amount: maxUint256,
        expiration: BigInt(2 ** 48 - 1), // Far future
        nonce: 0n,
      },
    };

    // Add native token holding for bundler (needed for gas fees and operations)
    startState.holdings[bundlerGeneralAdapter]["0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"] = {
      balance: maxUint256,
      user: bundlerGeneralAdapter,
      token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      erc20Allowances: {
        morpho: maxUint256,
        permit2: maxUint256,
        "bundler3.generalAdapter1": maxUint256,
      },
      permit2BundlerAllowance: {
        amount: maxUint256,
        expiration: BigInt(2 ** 48 - 1),
        nonce: 0n,
      },
    };

    // Initialize bundler3 holdings
    if (!startState.holdings[bundlerBundler3]) {
      startState.holdings[bundlerBundler3] = {};
    }

    // Add native token holding for bundler3 address itself
    startState.holdings[bundlerBundler3]["0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"] = {
      balance: maxUint256,
      user: bundlerBundler3,
      token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      erc20Allowances: {
        morpho: maxUint256,
        permit2: maxUint256,
        "bundler3.generalAdapter1": maxUint256,
      },
      permit2BundlerAllowance: {
        amount: maxUint256,
        expiration: BigInt(2 ** 48 - 1),
        nonce: 0n,
      },
    };

    // Add loan token holding for bundler3 address
    startState.holdings[bundlerBundler3][initialMarket.params.loanToken] = {
      balance: maxUint256,
      user: bundlerBundler3,
      token: initialMarket.params.loanToken,
      erc20Allowances: {
        morpho: maxUint256,
        permit2: maxUint256,
        "bundler3.generalAdapter1": maxUint256,
      },
      permit2BundlerAllowance: {
        amount: maxUint256,
        expiration: BigInt(2 ** 48 - 1),
        nonce: 0n,
      },
    };

    // Add native token holdings for all vault addresses that might be involved in reallocation
    const vaultAddresses = [...new Set(rpcData.withdrawals.map(w => w.vault))];
    console.log(`🔍 [VAULT DEBUG] Found ${vaultAddresses.length} vault addresses for reallocation:`, vaultAddresses);
    console.log(`🔍 [BUNDLER DEBUG] Bundler addresses:`, {
      bundlerGeneralAdapter,
      bundlerBundler3,
      morpho: bundlerAddresses.morpho
    });
    
    for (const vaultAddress of vaultAddresses) {
      if (!startState.holdings[vaultAddress]) {
        startState.holdings[vaultAddress] = {};
      }
      
      // Add native token holding for each vault
      startState.holdings[vaultAddress]["0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"] = {
        balance: maxUint256,
        user: vaultAddress,
        token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        erc20Allowances: {
          morpho: maxUint256,
          permit2: maxUint256,
          "bundler3.generalAdapter1": maxUint256,
        },
        permit2BundlerAllowance: {
          amount: maxUint256,
          expiration: BigInt(2 ** 48 - 1),
          nonce: 0n,
        },
      };
      
      // Add loan token holding for each vault (needed for reallocation operations)
      startState.holdings[vaultAddress][initialMarket.params.loanToken] = {
        balance: maxUint256,
        user: vaultAddress,
        token: initialMarket.params.loanToken,
        erc20Allowances: {
          morpho: maxUint256,
          permit2: maxUint256,
          "bundler3.generalAdapter1": maxUint256,
        },
        permit2BundlerAllowance: {
          amount: maxUint256,
          expiration: BigInt(2 ** 48 - 1),
          nonce: 0n,
        },
      };
    }
    
    // Debug: Log all addresses that have holdings set up
    const allAddressesWithHoldings = Object.keys(startState.holdings);
    console.log(`🔍 [HOLDINGS DEBUG] All addresses with holdings:`, allAddressesWithHoldings);

    // Scale the requested liquidity with the correct decimals
    const scaledRequestedLiquidity =
      requestedLiquidity * BigInt(10 ** apiMetrics.decimals);

    // Create operations for this borrowAmount
    const operations: InputBundlerOperation[] = [
      {
        type: "Blue_SupplyCollateral",
        sender: userAddress,
        address: morpho,
        args: {
          id: marketId,
          assets: maxUint256 / 2n,
          onBehalf: userAddress,
        },
      },
      {
        type: "Blue_Borrow",
        sender: userAddress,
        address: morpho,
        args: {
          id: marketId,
          assets: scaledRequestedLiquidity,
          onBehalf: userAddress,
          receiver: userAddress,
          slippage: DEFAULT_SLIPPAGE_TOLERANCE,
        },
      },
    ];

    // The key part: Populate the bundle with public allocator options
    const populatedBundle = populateBundle(operations, startState, {
      publicAllocatorOptions: {
        enabled: true,
        defaultSupplyTargetUtilization: DEFAULT_SUPPLY_TARGET_UTILIZATION,
        supplyTargetUtilization,
        maxWithdrawalUtilization,
        reallocatableVaults,
      },
    });

    // Extract any MetaMorpho_PublicReallocate operations
    const publicReallocateOps = populatedBundle.operations.filter(
      (op) => op.type === "MetaMorpho_PublicReallocate"
    );
    const reallocatedAmountFromBundle = publicReallocateOps.reduce(
      (acc, op) =>
        acc +
        op.args.withdrawals.reduce(
          (sum, withdrawal) => sum + withdrawal.assets,
          0n
        ),
      0n
    );

    const utilizationPostReallocation =
      initialMarket.utilization +
      reallocatedAmountFromBundle / initialMarket.liquidity;

    // Get final state
    const finalState = getLast(populatedBundle.steps);

    const simulatedFinalMarket = finalState.getMarket(marketId);

    // Build sourceMarkets based on publicReallocateOps
    const sourceMarkets: { [marketId: string]: MarketSimulationResult } = {};

    // Process each public reallocation operation
    for (const reallocateOp of publicReallocateOps) {
      // Extract withdrawals from the operation
      const { withdrawals } = reallocateOp.args;

      // Process each withdrawal which corresponds to a source market
      for (const withdrawal of withdrawals) {
        const sourceMarketId = withdrawal.id;
        const reallocatedAmount = withdrawal.assets;

        // Get initial state for the source market
        const sourceMarketInitial = startState.getMarket(sourceMarketId);

        // Get final state for the source market
        const sourceMarketFinal = finalState.getMarket(sourceMarketId);

        // Add to sourceMarkets object
        sourceMarkets[sourceMarketId] = {
          preReallocation: {
            liquidity: sourceMarketInitial.liquidity,
            borrowApy: sourceMarketInitial.borrowApy,
            utilization: sourceMarketInitial.utilization,
          },
          postReallocation: {
            liquidity: sourceMarketFinal.liquidity,
            borrowApy: sourceMarketFinal.borrowApy,
            reallocatedAmount,
            utilization: sourceMarketFinal.utilization,
          },
        };
      }
    }

    // Add simulation results
    result.simulation = {
      targetMarket: {
        preReallocation: {
          liquidity: initialMarket.liquidity,
          borrowApy: initialMarket.borrowApy,
          utilization: initialMarket.utilization,
        },
        postReallocation: {
          liquidity: initialMarket.liquidity + reallocatedAmountFromBundle,
          borrowApy: 0n,
          reallocatedAmount: reallocatedAmountFromBundle,
          utilization: utilizationPostReallocation,
        },
        postBorrow: {
          liquidity: simulatedFinalMarket.liquidity,
          borrowApy: simulatedFinalMarket.borrowApy,
          borrowAmount: scaledRequestedLiquidity,
          utilization: simulatedFinalMarket.utilization,
        },
      },
      sourceMarkets,
    };

    result.reason = {
      type: "success",
      message:
        publicReallocateOps.length > 0
          ? "Successfully simulated with reallocation"
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
    const userAddress: Address = "0x7f7A70b5B584C4033CAfD52219a496Df9AFb1af7";
    const [
      { loader },
      {
        supplyTargetUtilization,
        maxWithdrawalUtilization,
        reallocatableVaults,
      },
    ] = await Promise.all([
      initializeClientAndLoader(chainId),
      fetchMarketTargets(chainId),
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

    const startState = rpcData.startState;
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

    const { morpho } = getChainAddresses(chainId);

    // Initialize user position for this market (THIS IS THE KEY ADDITION)
    if (!startState.users[userAddress]) {
      startState.users[userAddress] = {
        address: userAddress,
        isBundlerAuthorized: false,
        morphoNonce: 0n,
      };
    }

    // Initialize user position for this market
    if (!startState.positions[userAddress]) {
      startState.positions[userAddress] = {};
    }

    // Add an empty position for this market
    startState.positions[userAddress][marketId] = {
      supplyShares: 0n,
      borrowShares: 0n,
      collateral: 0n,
      user: userAddress,
      marketId: marketId,
    };

    // Prepare user holdings for simulation
    if (!startState.holdings[userAddress]) {
      startState.holdings[userAddress] = {};
    }

    startState.holdings[userAddress][initialMarket.params.collateralToken] = {
      balance: maxUint256 / 2n,
      user: userAddress,
      token: initialMarket.params.collateralToken,
      erc20Allowances: {
        morpho: maxUint256,
        permit2: 0n,
        "bundler3.generalAdapter1": maxUint256,
      },
      permit2BundlerAllowance: {
        amount: 0n,
        expiration: 0n,
        nonce: 0n,
      },
    };

    // Add native token holding for user (needed for gas fees)
    startState.holdings[userAddress]["0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"] = {
      balance: maxUint256,
      user: userAddress,
      token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      erc20Allowances: {
        morpho: maxUint256,
        permit2: maxUint256,
        "bundler3.generalAdapter1": maxUint256,
      },
      permit2BundlerAllowance: {
        amount: maxUint256,
        expiration: BigInt(2 ** 48 - 1),
        nonce: 0n,
      },
    };

    // Get bundler addresses
    const bundlerAddresses = getChainAddresses(chainId);
    const bundlerGeneralAdapter = bundlerAddresses.bundler3.generalAdapter1;
    const bundlerBundler3 = bundlerAddresses.bundler3.bundler3;
    
    // Debug: Check if bundler addresses are properly defined
    console.log(`🔍 [BUNDLER ADDRESSES DEBUG] bundlerAddresses:`, bundlerAddresses);
    console.log(`🔍 [BUNDLER ADDRESSES DEBUG] bundlerGeneralAdapter:`, bundlerGeneralAdapter);
    console.log(`🔍 [BUNDLER ADDRESSES DEBUG] bundlerBundler3:`, bundlerBundler3);
    
    // Safety check: ensure bundlerBundler3 is defined
    if (!bundlerBundler3) {
      console.error(`❌ [BUNDLER ERROR] bundlerBundler3 is undefined! bundlerAddresses:`, bundlerAddresses);
      throw new Error(`bundlerBundler3 address is undefined for chainId ${chainId}`);
    }

    // Initialize bundler adapter holding for the collateral token
    if (!startState.holdings[bundlerGeneralAdapter]) {
      startState.holdings[bundlerGeneralAdapter] = {};
    }

    // Add the collateral token to the bundler's holdings
    startState.holdings[bundlerGeneralAdapter][
      initialMarket.params.collateralToken
    ] = {
      balance: maxUint256, // Very large balance
      user: bundlerGeneralAdapter,
      token: initialMarket.params.collateralToken,
      erc20Allowances: {
        morpho: maxUint256,
        permit2: maxUint256,
        "bundler3.generalAdapter1": maxUint256,
      },
      permit2BundlerAllowance: {
        amount: maxUint256,
        expiration: BigInt(2 ** 48 - 1), // Far future
        nonce: 0n,
      },
    };

    // Add native token holding for bundler (needed for gas fees and operations)
    startState.holdings[bundlerGeneralAdapter]["0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"] = {
      balance: maxUint256,
      user: bundlerGeneralAdapter,
      token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      erc20Allowances: {
        morpho: maxUint256,
        permit2: maxUint256,
        "bundler3.generalAdapter1": maxUint256,
      },
      permit2BundlerAllowance: {
        amount: maxUint256,
        expiration: BigInt(2 ** 48 - 1),
        nonce: 0n,
      },
    };

    // Initialize bundler3 holdings
    if (!startState.holdings[bundlerBundler3]) {
      startState.holdings[bundlerBundler3] = {};
    }

    // Add native token holding for bundler3 address itself
    startState.holdings[bundlerBundler3]["0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"] = {
      balance: maxUint256,
      user: bundlerBundler3,
      token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      erc20Allowances: {
        morpho: maxUint256,
        permit2: maxUint256,
        "bundler3.generalAdapter1": maxUint256,
      },
      permit2BundlerAllowance: {
        amount: maxUint256,
        expiration: BigInt(2 ** 48 - 1),
        nonce: 0n,
      },
    };

    // Add loan token holding for bundler3 address
    startState.holdings[bundlerBundler3][initialMarket.params.loanToken] = {
      balance: maxUint256,
      user: bundlerBundler3,
      token: initialMarket.params.loanToken,
      erc20Allowances: {
        morpho: maxUint256,
        permit2: maxUint256,
        "bundler3.generalAdapter1": maxUint256,
      },
      permit2BundlerAllowance: {
        amount: maxUint256,
        expiration: BigInt(2 ** 48 - 1),
        nonce: 0n,
      },
    };

    // Add native token holdings for all vault addresses that might be involved in reallocation
    const vaultAddresses = [...new Set(rpcData.withdrawals.map(w => w.vault))];
    console.log(`🔍 [VAULT DEBUG] Found ${vaultAddresses.length} vault addresses for reallocation:`, vaultAddresses);
    console.log(`🔍 [BUNDLER DEBUG] Bundler addresses:`, {
      bundlerGeneralAdapter,
      bundlerBundler3,
      morpho: bundlerAddresses.morpho
    });
    
    for (const vaultAddress of vaultAddresses) {
      if (!startState.holdings[vaultAddress]) {
        startState.holdings[vaultAddress] = {};
      }
      
      // Add native token holding for each vault
      startState.holdings[vaultAddress]["0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"] = {
        balance: maxUint256,
        user: vaultAddress,
        token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        erc20Allowances: {
          morpho: maxUint256,
          permit2: maxUint256,
          "bundler3.generalAdapter1": maxUint256,
        },
        permit2BundlerAllowance: {
          amount: maxUint256,
          expiration: BigInt(2 ** 48 - 1),
          nonce: 0n,
        },
      };
      
      // Add loan token holding for each vault (needed for reallocation operations)
      startState.holdings[vaultAddress][initialMarket.params.loanToken] = {
        balance: maxUint256,
        user: vaultAddress,
        token: initialMarket.params.loanToken,
        erc20Allowances: {
          morpho: maxUint256,
          permit2: maxUint256,
          "bundler3.generalAdapter1": maxUint256,
        },
        permit2BundlerAllowance: {
          amount: maxUint256,
          expiration: BigInt(2 ** 48 - 1),
          nonce: 0n,
        },
      };
    }
    
    // Debug: Log all addresses that have holdings set up
    const allAddressesWithHoldings = Object.keys(startState.holdings);
    console.log(`🔍 [HOLDINGS DEBUG] All addresses with holdings:`, allAddressesWithHoldings);

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

    // Run simulations for each percentage
    for (const percentage of percentages) {
      const borrowAmount = (maxLiquidity * BigInt(percentage)) / 100n;
      borrowAmounts.push(borrowAmount);

      // Skip if borrowAmount is 0
      if (borrowAmount === 0n && percentage > 0) continue;

      // Add rate limiting to prevent hitting Alchemy's rate limits
      if (percentage > 0) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between calls
      }

      // Create operations for this borrowAmount
      const operations: InputBundlerOperation[] = [
        {
          type: "Blue_SupplyCollateral",
          sender: userAddress,
          address: morpho,
          args: {
            id: marketId,
            assets: maxUint256 / 2n,
            onBehalf: userAddress,
          },
        },
        {
          type: "Blue_Borrow",
          sender: userAddress,
          address: morpho,
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
        // Simulate operations with the fetched targets
        const { steps } = populateBundle(operations, startState, {
          publicAllocatorOptions: {
            enabled: true,
            defaultSupplyTargetUtilization: DEFAULT_SUPPLY_TARGET_UTILIZATION,
            supplyTargetUtilization,
            maxWithdrawalUtilization,
            reallocatableVaults,
          },
        });

        // Debug: Log when we reach certain percentages
        if (percentage % 10 === 0) {
          console.log(`📊 [SIMULATION DEBUG] Simulating at ${percentage}% with borrow amount: ${borrowAmount.toString()}`);
        }

        // Debug: Check if reallocation operations were added by examining the steps
        const hasReallocationSteps = steps.length > 2; // Basic operations + reallocation steps
        if (hasReallocationSteps && percentage >= 15) {
          console.log(`🔄 [REALLOCATION DEBUG] At ${percentage}%: Bundle has ${steps.length} steps (likely includes reallocation)`);
        }

        // Get final state
        const finalState = getLast(steps);
        const simulatedMarket = finalState.getMarket(marketId);

        // Store utilization and APY values (as percentages)
        utilizationSeries.push(
          Number(formatUnits(simulatedMarket.utilization, 16))
        );
        apySeries.push(Number(formatUnits(simulatedMarket.borrowApy, 16)));
      } catch (error) {
        console.error(`❌ [SIMULATION ERROR] Error simulating at ${percentage}%:`, error);
        console.error(`❌ [SIMULATION ERROR] Borrow amount: ${borrowAmount.toString()}`);
        console.error(`❌ [SIMULATION ERROR] Market liquidity: ${initialMarket.liquidity.toString()}`);
        console.error(`❌ [SIMULATION ERROR] Available vaults:`, vaultAddresses);
        
        // Check if it's a rate limit error
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('compute units per second') || errorMessage.includes('rate limit')) {
          console.warn(`⚠️ [RATE LIMIT] Hit rate limit at ${percentage}%. Waiting 2 seconds before continuing...`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          
          // Try one more time after waiting
          try {
            const { steps } = populateBundle(operations, startState, {
              publicAllocatorOptions: {
                enabled: true,
                defaultSupplyTargetUtilization: DEFAULT_SUPPLY_TARGET_UTILIZATION,
                supplyTargetUtilization,
                maxWithdrawalUtilization,
                reallocatableVaults,
              },
            });
            
            const finalState = getLast(steps);
            const simulatedMarket = finalState.getMarket(marketId);
            
            utilizationSeries.push(
              Number(formatUnits(simulatedMarket.utilization, 16))
            );
            apySeries.push(Number(formatUnits(simulatedMarket.borrowApy, 16)));
            
            console.log(`✅ [RETRY SUCCESS] Successfully retried simulation at ${percentage}%`);
            continue; // Skip the fallback below
          } catch (retryError) {
            console.error(`❌ [RETRY FAILED] Retry also failed at ${percentage}%:`, retryError);
          }
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

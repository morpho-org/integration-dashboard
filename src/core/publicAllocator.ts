import type { Market, MarketId } from "@morpho-org/blue-sdk";
import { morphoViemExtension } from "@morpho-org/morpho-sdk";
import { getChainAddresses } from "@morpho-org/morpho-sdk/addresses";
import { VaultV2BlueReallocationData } from "@morpho-org/morpho-sdk/entities";
import {
  fetchMarket,
  fetchMarketParams,
} from "@morpho-org/morpho-sdk/blue/fetch";
import type { MarketParams } from "@morpho-org/morpho-sdk/blue/entities";
import { createPublicClient } from "viem";
import { getChainConfig } from "../config/chains";
import {
  fetchPublicAllocatorVaults,
  type PublicAllocatorCandidate,
} from "../fetchers/fetchPublicAllocatorVaults";
import { createProxyTransport } from "../utils/client";
import {
  getLiquidityBreakdown,
  planBorrow,
  type BorrowPlan,
} from "./publicAllocatorPlan";

const API_URL = "https://blue-api.morpho.org/graphql";
const MARKET_QUERY = `
query MarketByUniqueKey($uniqueKey: String!, $chainId: Int!) {
  marketByUniqueKey: marketById(marketId: $uniqueKey, chainId: $chainId) {
    loanAsset { address decimals priceUsd symbol }
    collateralAsset { address symbol }
    lltv
    state { utilization }
  }
}`;

export interface LiquidityBreakdown {
  local: bigint;
  shared: bigint;
  total: bigint;
}

export interface MarketSimulationStats {
  liquidity: bigint;
  borrowApy: bigint;
  utilization: bigint;
}

export interface MarketSimulationResult {
  preReallocation: MarketSimulationStats;
  postReallocation: MarketSimulationStats & { reallocatedAmount: bigint };
}

export interface SimulationResults {
  targetMarket: MarketSimulationResult & {
    postBorrow: MarketSimulationStats & { borrowAmount: bigint };
  };
  sourceMarkets: Record<string, MarketSimulationResult>;
}

export interface ReallocationResult {
  requestedLiquidity: bigint;
  currentMarketLiquidity: bigint;
  liquidity: LiquidityBreakdown;
  plan: BorrowPlan;
  candidates: readonly PublicAllocatorCandidate[];
  marketParams: MarketParams;
  snapshotBlock: { number: bigint; timestamp: bigint };
  apiMetrics: {
    decimals: number;
    priceUsd: number;
    symbol: string;
    loanAsset: { address: string; symbol: string };
    collateralAsset: { address: string; symbol: string };
    lltv: bigint;
    utilization: bigint;
    maxBorrowWithoutReallocation: bigint;
  };
  simulation?: SimulationResults;
  reason: { type: "success" | "error"; message: string };
}

export interface ReallocationSnapshot {
  chainId: number;
  marketId: MarketId;
  marketParams: MarketParams;
  block: { number: bigint; timestamp: bigint };
  data: VaultV2BlueReallocationData;
  candidates: readonly PublicAllocatorCandidate[];
}

interface MarketApiData {
  loanAsset: {
    address: string;
    decimals: number;
    priceUsd: number;
    symbol: string;
  };
  collateralAsset: { address: string; symbol: string };
  lltv: string;
  state: { utilization: number };
}

export interface MarketMetrics {
  decimals: number;
  priceUsd: number;
  symbol: string;
  loanAsset: { address: string; symbol: string };
  collateralAsset: { address: string; symbol: string };
  lltv: bigint;
  utilization: bigint;
}

/**
 * Fetch a block-consistent V2 allocator and Blue market snapshot.
 */
export async function loadReallocationSnapshot(
  chainId: number,
  marketId: MarketId,
): Promise<ReallocationSnapshot> {
  const chainConfig = getChainConfig(chainId);
  if (!chainConfig) throw new Error(`Unsupported chain ID: ${chainId}`);

  const client = createPublicClient({
    chain: chainConfig.viemChain,
    transport: createProxyTransport(chainId),
  }).extend(morphoViemExtension());
  const [block, marketParams, allocatorData] = await Promise.all([
    client.getBlock(),
    fetchMarketParams(marketId, client),
    fetchPublicAllocatorVaults(chainId, marketId),
  ]);

  let registeredAllocator: string | undefined;
  try {
    registeredAllocator =
      getChainAddresses(chainId).vaultV2BluePublicAllocator;
  } catch {
    throw new Error(
      `Chain ${chainId} does not support the V2 public allocator.`,
    );
  }
  if (!registeredAllocator)
    throw new Error(
      `Chain ${chainId} does not support the V2 public allocator.`,
    );
  if (
    allocatorData.publicAllocator !== null &&
    allocatorData.publicAllocator.toLowerCase() !==
      registeredAllocator.toLowerCase()
  )
    throw new Error(
      `Consumer API allocator ${allocatorData.publicAllocator} does not match the registered V2 allocator ${registeredAllocator}.`,
    );

  const vaultAddresses = [
    ...new Map(
      allocatorData.items.map((candidate) => [
        candidate.vault.toLowerCase(),
        candidate.vault,
      ]),
    ).values(),
  ];
  const market = client.morpho.blue(marketParams, chainId);
  const data =
    vaultAddresses.length === 0
      ? new VaultV2BlueReallocationData({
          chainId,
          markets: {
            [marketId]: await fetchMarket(marketId, client, {
              blockNumber: block.number,
            }),
          },
        })
      : await market.getVaultV2BlueReallocationData({
          vaultAddresses,
          block: { number: block.number, timestamp: block.timestamp },
        });

  return {
    chainId,
    marketId,
    marketParams,
    block: { number: block.number, timestamp: block.timestamp },
    data,
    candidates: allocatorData.items,
  };
}

export async function fetchMarketMetricsFromAPI(
  marketId: MarketId,
  chainId: number,
): Promise<MarketMetrics> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: MARKET_QUERY,
      variables: { uniqueKey: marketId, chainId },
    }),
  });
  if (!response.ok)
    throw new Error(`Market metadata request failed with HTTP ${response.status}`);

  const payload = (await response.json()) as {
    data?: { marketByUniqueKey?: MarketApiData | null };
    errors?: Array<{ message?: string }>;
  };
  const marketData = payload.data?.marketByUniqueKey;
  if (!marketData)
    throw new Error(
      payload.errors?.[0]?.message ?? "Market metadata was not found.",
    );

  return {
    decimals: marketData.loanAsset.decimals,
    priceUsd: marketData.loanAsset.priceUsd,
    symbol: marketData.loanAsset.symbol,
    loanAsset: marketData.loanAsset,
    collateralAsset: marketData.collateralAsset,
    lltv: BigInt(marketData.lltv),
    utilization: BigInt(Math.floor(marketData.state.utilization * 1e18)),
  };
}

function stats(market: Market, timestamp: bigint): MarketSimulationStats {
  return {
    liquidity: market.accrueInterest(timestamp).liquidity,
    borrowApy: BigInt(Math.floor(market.getBorrowApy(timestamp) * 1e18)),
    utilization: market.utilization,
  };
}

function simulatedMarkets(
  data: VaultV2BlueReallocationData,
  plan: BorrowPlan,
  timestamp: bigint,
): SimulationResults | undefined {
  if (
    plan.status !== "no-reallocation" &&
    plan.status !== "reallocations"
  )
    return;

  const marketBefore = plan.marketBefore;
  const marketAfterReallocation =
    plan.status === "reallocations"
      ? plan.marketAfterReallocation
      : marketBefore;
  const reallocatedAmount =
    plan.status === "reallocations"
      ? plan.reallocations.reduce((sum, item) => sum + item.assets, 0n)
      : 0n;
  const sourceMarkets: SimulationResults["sourceMarkets"] = {};

  if (plan.status === "reallocations") {
    const allocationsByMarket = new Map<MarketId, bigint>();
    for (const reallocation of plan.reallocations) {
      if (reallocation.from.type !== "market") continue;
      const sourceId = reallocation.from.marketParams.id;
      allocationsByMarket.set(
        sourceId,
        (allocationsByMarket.get(sourceId) ?? 0n) + reallocation.assets,
      );
    }
    for (const [sourceId, assets] of allocationsByMarket) {
      const sourceBefore = data
        .getMarket(sourceId)
        .accrueInterest(timestamp);
      const sourceAfter = sourceBefore.withdraw(assets, 0n, timestamp).market;
      sourceMarkets[sourceId] = {
        preReallocation: stats(sourceBefore, timestamp),
        postReallocation: {
          ...stats(sourceAfter, timestamp),
          reallocatedAmount: assets,
        },
      };
    }
  }

  return {
    targetMarket: {
      preReallocation: stats(marketBefore, timestamp),
      postReallocation: {
        ...stats(marketAfterReallocation, timestamp),
        reallocatedAmount,
      },
      postBorrow: {
        ...stats(plan.marketAfterBorrow, timestamp),
        borrowAmount:
          plan.marketAfterBorrow.totalBorrowAssets -
          marketAfterReallocation.totalBorrowAssets,
      },
    },
    sourceMarkets,
  };
}

function resultForPlan(
  requestedLiquidity: bigint,
  snapshot: ReallocationSnapshot,
  metrics: MarketMetrics,
  plan: BorrowPlan,
): ReallocationResult {
  const liquidity = getLiquidityBreakdown(
    snapshot.data,
    snapshot.marketId,
    snapshot.block.timestamp,
  );
  const simulation = simulatedMarkets(
    snapshot.data,
    plan,
    snapshot.block.timestamp,
  );
  const failed =
    plan.status === "insufficient-liquidity" || plan.status === "error";

  return {
    requestedLiquidity,
    currentMarketLiquidity: liquidity.local,
    liquidity,
    plan,
    candidates: snapshot.candidates,
    marketParams: snapshot.marketParams,
    snapshotBlock: snapshot.block,
    apiMetrics: {
      ...metrics,
      maxBorrowWithoutReallocation: liquidity.local,
    },
    ...(simulation ? { simulation } : {}),
    reason: failed
      ? { type: "error", message: plan.message }
      : {
          type: "success",
          message:
            plan.status === "reallocations"
              ? "V2 reallocation plan computed."
              : "No V2 reallocation is required.",
        },
  };
}

/**
 * Simulate borrowing the requested loan-token amount from a Blue market.
 */
export async function fetchMarketSimulationBorrow(
  marketId: MarketId,
  chainId: number,
  requestedLiquidity: bigint,
): Promise<ReallocationResult> {
  const [snapshot, metrics] = await Promise.all([
    loadReallocationSnapshot(chainId, marketId),
    fetchMarketMetricsFromAPI(marketId, chainId),
  ]);
  const plan = planBorrow(
    snapshot.data,
    marketId,
    requestedLiquidity,
    snapshot.block.timestamp,
  );
  return resultForPlan(requestedLiquidity, snapshot, metrics, plan);
}

export interface SimulationSeries {
  percentages: number[];
  initialLiquidity: bigint;
  utilizationSeries: number[];
  apySeries: number[];
  borrowAmounts: bigint[];
  error?: string;
  warning?: string;
}

/**
 * Simulate a 0–100% series from a single V2 allocator snapshot.
 */
export async function fetchMarketSimulationSeries(
  marketId: MarketId,
  chainId: number,
): Promise<SimulationSeries> {
  const snapshot = await loadReallocationSnapshot(chainId, marketId);
  const liquidity = getLiquidityBreakdown(
    snapshot.data,
    marketId,
    snapshot.block.timestamp,
  );
  const maxLiquidity = (liquidity.total * 999n) / 1000n;
  const percentages: number[] = [];
  const utilizationSeries: number[] = [];
  const apySeries: number[] = [];
  const borrowAmounts: bigint[] = [];

  for (let percentage = 0; percentage <= 100; percentage += 5) {
    const amount = (maxLiquidity * BigInt(percentage)) / 100n;
    const plan = planBorrow(
      snapshot.data,
      marketId,
      amount,
      snapshot.block.timestamp,
    );
    if (plan.status === "error" || plan.status === "insufficient-liquidity") {
      if (percentages.length === 0)
        return {
          percentages,
          initialLiquidity: liquidity.total,
          utilizationSeries,
          apySeries,
          borrowAmounts,
          error: plan.message,
        };
      return {
        percentages,
        initialLiquidity: liquidity.total,
        utilizationSeries,
        apySeries,
        borrowAmounts,
        warning: plan.message,
      };
    }
    try {
      const market = plan.marketAfterBorrow.accrueInterest(
        snapshot.block.timestamp,
      );
      percentages.push(percentage);
      borrowAmounts.push(amount);
      utilizationSeries.push(Number(market.utilization) / 1e16);
      apySeries.push(market.getBorrowApy(snapshot.block.timestamp) * 100);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        percentages,
        initialLiquidity: liquidity.total,
        utilizationSeries,
        apySeries,
        borrowAmounts,
        ...(percentages.length === 0 ? { error: message } : { warning: message }),
      };
    }
  }

  return {
    percentages,
    initialLiquidity: liquidity.total,
    utilizationSeries,
    apySeries,
    borrowAmounts,
  };
}

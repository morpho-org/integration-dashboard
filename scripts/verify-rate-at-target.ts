/**
 * Verification script: Rate at Target Discrepancy
 *
 * Demonstrates why the integration dashboard (~3.27-3.31%) and Morpho frontend (~2.92%)
 * show different "rate at target" values for the cbBTC/pyUSD market.
 *
 * TL;DR: Both are correct — they measure different things.
 * - Morpho FE: APY at exactly 90% utilization (rateAtTarget compounded)
 * - Dashboard: APY after borrowing 90% of total available liquidity
 *   (market + public allocator), which results in ~90.43% utilization
 *
 * Run: npx tsx scripts/verify-rate-at-target.ts
 */

import { Market, type MarketId } from "@morpho-org/blue-sdk";
import "@morpho-org/blue-sdk-viem/lib/augment";
import { createPublicClient, formatUnits, http } from "viem";
import { mainnet } from "viem/chains";

// ─── Constants (replicated from src/config/constants.ts) ───

const WAD = 1_000_000_000_000_000_000n;
const YEAR = 365n * 24n * 60n * 60n;
const TARGET_UTILIZATION = 900_000_000_000_000_000n; // 0.9 WAD = 90%
const DEFAULT_SUPPLY_TARGET_UTILIZATION = 90_5000000000000000n; // 0.905 WAD = 90.5%

// ─── Math helpers (replicated from src/utils/maths.ts) ───

const mulDivDown = (x: bigint, y: bigint, d: bigint): bigint => (x * y) / d;
const mulDivUp = (x: bigint, y: bigint, d: bigint): bigint =>
  (x * y + (d - 1n)) / d;
const wDivDown = (x: bigint, y: bigint): bigint => mulDivDown(x, WAD, y);
const wMulDown = (x: bigint, y: bigint): bigint => mulDivDown(x, y, WAD);

const wTaylorCompounded = (x: bigint, n: bigint): bigint => {
  const firstTerm = x * n;
  const secondTerm = mulDivDown(firstTerm, firstTerm, 2n * WAD);
  const thirdTerm = mulDivDown(secondTerm, firstTerm, 3n * WAD);
  return firstTerm + secondTerm + thirdTerm;
};

/**
 * Compute borrow APY for a given utilization and rateAtTarget.
 * Replicates computeNewBorrowAPY from src/utils/maths.ts:361-383
 */
function computeBorrowAPY(newUtilization: bigint, rateAtTarget: bigint): bigint {
  let newRate: bigint;
  if (newUtilization > TARGET_UTILIZATION) {
    newRate =
      rateAtTarget +
      mulDivUp(
        3n * rateAtTarget,
        newUtilization - TARGET_UTILIZATION,
        WAD - TARGET_UTILIZATION
      );
  } else {
    newRate =
      mulDivUp(3n * rateAtTarget, newUtilization, 4n * TARGET_UTILIZATION) +
      rateAtTarget / 4n;
  }
  return wTaylorCompounded(newRate, YEAR);
}

/** Convert WAD-scaled APY bigint to a percentage number (e.g. 2.92 for 2.92%) */
function wadToPercent(wad: bigint): number {
  return Number(formatUnits(wad, 16));
}

// ─── Morpho Blue API query ───

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
        uniqueKey
        targetBorrowUtilization
        targetWithdrawUtilization
        state {
          utilization
          supplyAssets
          borrowAssets
        }
        collateralAsset { symbol }
        loanAsset { symbol }
      }
    }
    loanAsset {
      decimals
      priceUsd
      symbol
    }
    collateralAsset {
      symbol
    }
    state {
      liquidityAssets
      supplyAssets
      borrowAssets
      utilization
    }
  }
}
`;

async function fetchMarketFromAPI(marketId: string) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: MARKET_QUERY,
      variables: { uniqueKey: marketId, chainId: 1 },
    }),
  });
  const json = (await res.json()) as { data?: { marketByUniqueKey?: any } };
  return json?.data?.marketByUniqueKey;
}

// ─── Main ───

async function main() {
  const MARKET_ID =
    "0xd8a8e6667f58aa9229e8979bd619742b1660ee856c200a93e407dbccb7222323" as MarketId;

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL_MAINNET;
  if (!rpcUrl) {
    console.error("Missing NEXT_PUBLIC_RPC_URL_MAINNET in .env.local");
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Rate at Target Verification: cbBTC/pyUSD Market");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 1. Fetch on-chain market state via blue-sdk
  console.log("Fetching on-chain market state...");
  const client = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl),
  });

  const market = await Market.fetch(MARKET_ID, client as any);

  const rateAtTarget = market.rateAtTarget ?? 0n;
  const totalSupply = market.totalSupplyAssets;
  const totalBorrow = market.totalBorrowAssets;
  const utilization = market.utilization ?? 0n;
  const currentBorrowApy = market.borrowApy ?? 0;
  const onChainApyAtTarget = market.apyAtTarget ?? 0;
  const decimals = 6; // pyUSD has 6 decimals

  console.log("\n─── 1. On-Chain Market State ───\n");
  console.log(`  Total Supply:     ${formatUnits(totalSupply, decimals)} pyUSD`);
  console.log(`  Total Borrow:     ${formatUnits(totalBorrow, decimals)} pyUSD`);
  console.log(`  Utilization:      ${(Number(utilization) / 1e16).toFixed(2)}%`);
  console.log(`  Current Borrow APY: ${(Number(currentBorrowApy) * 100).toFixed(2)}%`);
  console.log(`  rateAtTarget (raw): ${rateAtTarget}`);
  console.log(`  SDK apyAtTarget:  ${(Number(onChainApyAtTarget) * 100).toFixed(4)}%`);

  // 2. Fetch API data for public allocator info
  console.log("\nFetching Morpho API data...");
  const apiData = await fetchMarketFromAPI(MARKET_ID);
  if (!apiData) {
    console.error("Failed to fetch market data from API");
    process.exit(1);
  }

  const marketLiquidity = BigInt(apiData.state.liquidityAssets);
  const reallocatableLiquidity = BigInt(apiData.reallocatableLiquidityAssets);
  const totalAvailableLiquidity = marketLiquidity + reallocatableLiquidity;
  const apiSupply = BigInt(apiData.state.supplyAssets);
  const apiBorrow = BigInt(apiData.state.borrowAssets);
  const priceUsd = apiData.loanAsset.priceUsd;

  console.log("\n─── 2. Public Allocator Liquidity ───\n");
  console.log(
    `  Market liquidity:        ${formatUnits(marketLiquidity, decimals)} pyUSD ($${(Number(formatUnits(marketLiquidity, decimals)) * priceUsd).toFixed(0)})`
  );
  console.log(
    `  PA reallocatable:        ${formatUnits(reallocatableLiquidity, decimals)} pyUSD ($${(Number(formatUnits(reallocatableLiquidity, decimals)) * priceUsd).toFixed(0)})`
  );
  console.log(
    `  Total available:         ${formatUnits(totalAvailableLiquidity, decimals)} pyUSD ($${(Number(formatUnits(totalAvailableLiquidity, decimals)) * priceUsd).toFixed(0)})`
  );
  console.log(
    `  PA % of total:           ${((Number(reallocatableLiquidity) / Number(totalAvailableLiquidity)) * 100).toFixed(1)}%`
  );

  if (apiData.publicAllocatorSharedLiquidity?.length > 0) {
    console.log("\n  PA sources:");
    for (const item of apiData.publicAllocatorSharedLiquidity) {
      const vaultName = item.vault.name || item.vault.address.slice(0, 10);
      const assets = BigInt(item.assets);
      console.log(
        `    - ${vaultName}: ${formatUnits(assets, decimals)} pyUSD`
      );
    }
  }

  // 3. Compute APY at exactly 90% utilization (Morpho FE value)
  const apyAt90 = computeBorrowAPY(TARGET_UTILIZATION, rateAtTarget);
  const apyAt90Pct = wadToPercent(apyAt90);

  console.log("\n─── 3. APY Comparison ───\n");
  console.log(
    `  APY at exactly 90.00% utilization (Morpho FE):   ${apyAt90Pct.toFixed(4)}%`
  );

  // 4. Compute what utilization you'd get borrowing 90% of total available liquidity
  // When you borrow 90% of total available liquidity, the PA supplies enough
  // to target DEFAULT_SUPPLY_TARGET_UTILIZATION (90.5%).
  // The new supply = current supply + PA supply, new borrow = current borrow + borrow amount.
  // The resulting utilization ends up around 90.43% (above target).

  // Simulate: borrow 90% of totalAvailableLiquidity
  const borrowAmount90Pct = (totalAvailableLiquidity * 90n) / 100n;

  // After PA reallocation, the PA aims for 90.5% utilization
  // New borrow = apiBorrow + borrowAmount90Pct
  // The PA will supply enough to get close to its target utilization
  const newBorrow = apiBorrow + borrowAmount90Pct;
  // PA targets 90.5% utilization: newSupply = newBorrow / 0.905
  const paTargetSupply = wDivDown(newBorrow, DEFAULT_SUPPLY_TARGET_UTILIZATION);
  const paSupplyNeeded = paTargetSupply > apiSupply ? paTargetSupply - apiSupply : 0n;
  // Cap PA supply by reallocatable amount
  const actualPaSupply =
    paSupplyNeeded > reallocatableLiquidity
      ? reallocatableLiquidity
      : paSupplyNeeded;
  const newSupply = apiSupply + actualPaSupply;
  const simulatedUtilization = wDivDown(newBorrow, newSupply);

  const apyAtSimulated = computeBorrowAPY(simulatedUtilization, rateAtTarget);
  const apyAtSimulatedPct = wadToPercent(apyAtSimulated);

  console.log(
    `  Simulated utilization at 90% of total liq:       ${(Number(simulatedUtilization) / 1e16).toFixed(2)}%`
  );
  console.log(
    `  APY at ${(Number(simulatedUtilization) / 1e16).toFixed(2)}% utilization (Dashboard): ${apyAtSimulatedPct.toFixed(4)}%`
  );

  // 5. Also compute at exactly 90.5% for reference
  const util905 = 905_000_000_000_000_000n;
  const apyAt905 = computeBorrowAPY(util905, rateAtTarget);
  const apyAt905Pct = wadToPercent(apyAt905);
  console.log(
    `  APY at exactly 90.50% utilization (PA target):   ${apyAt905Pct.toFixed(4)}%`
  );

  // 6. Show the math
  console.log("\n─── 4. IRM Curve Math (above target) ───\n");
  console.log("  For utilization > 90% (target), the IRM formula is:");
  console.log("    rate = rateAtTarget + 3 * rateAtTarget * (u - 0.9) / (1 - 0.9)");
  console.log("    rate = rateAtTarget * (1 + 3 * (u - 0.9) / 0.1)");
  console.log("");

  const simUtilPct = Number(simulatedUtilization) / 1e16;
  const excessPct = simUtilPct - 90;
  const multiplier = 1 + 3 * (excessPct / 10);
  console.log(`  At u = ${simUtilPct.toFixed(2)}%:`);
  console.log(`    excess = ${simUtilPct.toFixed(2)}% - 90% = ${excessPct.toFixed(2)}%`);
  console.log(`    multiplier = 1 + 3 × ${excessPct.toFixed(2)}/10 = ${multiplier.toFixed(4)}`);
  console.log(`    rate = rateAtTarget × ${multiplier.toFixed(4)}`);
  console.log(`    APY ≈ ${apyAt90Pct.toFixed(2)}% × ${multiplier.toFixed(4)} ≈ ${(apyAt90Pct * multiplier).toFixed(2)}%`);

  console.log("\n─── 5. Summary ───\n");
  console.log("  ┌──────────────────────────────────┬────────────┬─────────────┐");
  console.log("  │ Source                           │ Util.      │ Borrow APY  │");
  console.log("  ├──────────────────────────────────┼────────────┼─────────────┤");
  console.log(
    `  │ Morpho FE (rate at target)       │ 90.00%     │ ${apyAt90Pct.toFixed(4).padStart(8)}%   │`
  );
  console.log(
    `  │ Dashboard (90% of total liq)     │ ${simUtilPct.toFixed(2).padStart(6)}%   │ ${apyAtSimulatedPct.toFixed(4).padStart(8)}%   │`
  );
  console.log(
    `  │ Current on-chain                 │ ${(Number(utilization) / 1e16).toFixed(2).padStart(6)}%   │ ${(Number(currentBorrowApy) * 100).toFixed(4).padStart(8)}%   │`
  );
  console.log("  └──────────────────────────────────┴────────────┴─────────────┘");
  console.log("");
  console.log("  Conclusion: The dashboard includes public allocator liquidity,");
  console.log("  which increases total available liquidity but results in utilization");
  console.log(`  slightly above target (${simUtilPct.toFixed(2)}% vs 90%). The IRM's steep curve`);
  console.log(`  above target (3× slope) amplifies this to a higher APY.`);
  console.log("");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

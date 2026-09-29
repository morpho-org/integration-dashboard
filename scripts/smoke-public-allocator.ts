import { formatUnits, parseUnits } from "viem";
import type { MarketId } from "@morpho-org/blue-sdk";
import {
  fetchMarketMetricsFromAPI,
  fetchMarketSimulationBorrow,
} from "../src/core/publicAllocator";

const chainId = 8453;
const marketId =
  "0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836" as MarketId;
const rpcUrl = process.env.RPC_URL_8453;
if (!rpcUrl) throw new Error("Set RPC_URL_8453 to a Base RPC endpoint.");

const originalFetch = globalThis.fetch.bind(globalThis);
const proxyUrl = `${
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}/api/rpc/${chainId}`;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = input instanceof Request ? input.url : input.toString();
  return originalFetch(url === proxyUrl ? rpcUrl : input, init);
}) as typeof fetch;

async function main() {
  const metadata = await fetchMarketMetricsFromAPI(marketId, chainId);
  const smallAmount = parseUnits("1", metadata.decimals);
  const localAndShared = await fetchMarketSimulationBorrow(
    marketId,
    chainId,
    smallAmount,
  );
  const reallocationAmount = parseUnits("100000", metadata.decimals);
  const targetAboveLocal =
    localAndShared.liquidity.shared > reallocationAmount
      ? localAndShared.liquidity.local + reallocationAmount
      : localAndShared.liquidity.local +
        localAndShared.liquidity.shared / 2n;
  const cases = [
    ["zero", 0n],
    ["small", smallAmount],
    ["local-plus-100k-ish", targetAboveLocal],
    ["above-total", localAndShared.liquidity.total + 1n],
  ] as const;

  for (const [name, amount] of cases) {
    const result = await fetchMarketSimulationBorrow(
      marketId,
      chainId,
      amount,
    );
    console.log(
      `${name}: amount=${formatUnits(amount, metadata.decimals)} ${metadata.symbol}; plan=${result.plan.status}; reason=${result.reason.type}`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

import type { MarketId } from "@morpho-org/blue-sdk";
import type { VaultV2BlueReallocation } from "@morpho-org/morpho-sdk";
import { type FC, type FormEvent, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useChainId, useSwitchChain } from "wagmi";
import AmountInput from "../components/AmountInput";
import MarketMetricsChart from "../components/MarketMetricsChart";
import TransactionSenderV2 from "../components/TransactionSenderV2";
import TransactionSimulatorV2 from "../components/TransactionSimulatorV2";
import {
  fetchMarketMetricsFromAPI,
  fetchMarketSimulationBorrow,
  fetchMarketSimulationSeries,
  type ReallocationResult,
  type SimulationSeries,
} from "../core/publicAllocator";
import {
  applyEditedAmounts,
  reallocationKey,
} from "../core/publicAllocatorPlan";
import { getPenaltyAssets } from "../core/publicAllocatorTx";
import { getChainConfigByName } from "../config/chains";
import type { SupportedNetwork } from "../types/networks";
import {
  formatMarketLink,
  formatUsdAmount,
  formatVaultLink,
  formatWAD,
} from "../utils/utils";

interface ManualReallocationPageProps {
  network: SupportedNetwork;
}

function displayAmount(amount: bigint, decimals: number, symbol: string) {
  return `${formatUnits(amount, decimals)} ${symbol}`;
}

function amountUsd(amount: bigint, decimals: number, priceUsd: number) {
  return Number(formatUnits(amount, decimals)) * priceUsd;
}

const ManualReallocationPage: FC<ManualReallocationPageProps> = ({
  network,
}) => {
  const networkId = getChainConfigByName(network).id;
  const walletChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const [marketId, setMarketId] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("0");
  const [result, setResult] = useState<ReallocationResult>();
  const [series, setSeries] = useState<SimulationSeries>();
  const [editedAmounts, setEditedAmounts] = useState<Record<string, bigint>>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const compute = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setResult(undefined);
    setSeries(undefined);
    if (!/^0x[0-9a-fA-F]{64}$/.test(marketId)) {
      setError("Enter a 32-byte market ID.");
      return;
    }

    setLoading(true);
    try {
      const metadata = await fetchMarketMetricsFromAPI(
        marketId as MarketId,
        networkId,
      );
      const metadataAndResult = await fetchMarketSimulationBorrow(
        marketId as MarketId,
        networkId,
        parseUnits(borrowAmount || "0", metadata.decimals),
      );
      setResult(metadataAndResult);
      if (metadataAndResult.plan.status === "reallocations")
        setEditedAmounts(
          Object.fromEntries(
            metadataAndResult.plan.reallocations.map((reallocation) => [
              reallocationKey(reallocation),
              reallocation.assets,
            ]),
          ),
        );
      const nextSeries = await fetchMarketSimulationSeries(
        marketId as MarketId,
        networkId,
      );
      setSeries(nextSeries);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  };

  const plan = result?.plan;
  const isPlanError =
    plan?.status === "insufficient-liquidity" || plan?.status === "error";
  const planReallocations: readonly VaultV2BlueReallocation[] =
    plan?.status === "reallocations"
      ? applyEditedAmounts(plan.reallocations, editedAmounts)
      : [];
  const sourceImpacts =
    plan?.status === "reallocations" ? plan.sourceImpacts : [];

  const setEditedAmount = (key: string, value: string, decimals: number) => {
    try {
      setEditedAmounts((current) => ({
        ...current,
        [key]: parseUnits(value || "0", decimals),
      }));
    } catch {
      setEditedAmounts((current) => ({ ...current, [key]: 0n }));
    }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-8 text-gray-900">
      <header>
        <h1 className="text-2xl font-semibold">Manual Reallocation</h1>
        <p className="mt-1 text-sm text-gray-600">
          Plan direct Public Allocator V2 reallocations into a Blue market.
        </p>
      </header>

      {walletChainId !== networkId && (
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white"
          onClick={() => void switchChainAsync({ chainId: networkId })}
          type="button"
        >
          Switch to {network}
        </button>
      )}

      <form
        className="grid gap-3 rounded-lg bg-white p-4 shadow sm:grid-cols-[2fr_1fr_auto]"
        onSubmit={compute}
      >
        <label className="space-y-1 text-sm">
          <span>Market ID</span>
          <input
            className="w-full rounded border px-3 py-2 font-mono"
            onChange={(event) => setMarketId(event.target.value.trim())}
            placeholder="0x…"
            value={marketId}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Borrow amount</span>
          <input
            className="w-full rounded border px-3 py-2"
            min="0"
            onChange={(event) => setBorrowAmount(event.target.value)}
            step="any"
            type="number"
            value={borrowAmount}
          />
        </label>
        <button
          className="self-end rounded bg-blue-600 px-5 py-2 text-white disabled:opacity-50"
          disabled={loading}
          type="submit"
        >
          {loading ? "Computing…" : "Compute"}
        </button>
      </form>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {result && (
        <>
          <p className="text-xs text-gray-500">
            Snapshot block {result.snapshotBlock.number.toString()} ·{" "}
            {new Date(
              Number(result.snapshotBlock.timestamp) * 1000,
            ).toLocaleString()}
          </p>
          <section className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["Local liquidity", result.liquidity.local],
                ["V2 shared liquidity", result.liquidity.shared],
                ["Total borrowable", result.liquidity.total],
              ] as const
            ).map(([title, amount]) => (
              <article className="rounded-lg bg-white p-4 shadow" key={title}>
                <h2 className="text-sm text-gray-500">{title}</h2>
                <p className="mt-2 text-xl font-semibold">
                  {displayAmount(
                    amount,
                    result.apiMetrics.decimals,
                    result.apiMetrics.symbol,
                  )}
                </p>
                <p className="text-sm text-gray-500">
                  {formatUsdAmount(
                    amountUsd(
                      amount,
                      result.apiMetrics.decimals,
                      result.apiMetrics.priceUsd,
                    ),
                  )}
                </p>
              </article>
            ))}
          </section>

          {isPlanError && (
            <div className="rounded border border-red-300 bg-red-50 p-4 text-red-800">
              <h2 className="font-semibold">Reallocation unavailable</h2>
              <p className="mt-1">
                Requested:{" "}
                {displayAmount(
                  result.requestedLiquidity,
                  result.apiMetrics.decimals,
                  result.apiMetrics.symbol,
                )}{" "}
                (
                {formatUsdAmount(
                  amountUsd(
                    result.requestedLiquidity,
                    result.apiMetrics.decimals,
                    result.apiMetrics.priceUsd,
                  ),
                )}
                ). Available:{" "}
                {displayAmount(
                  plan.status === "insufficient-liquidity"
                    ? plan.available
                    : result.liquidity.total,
                  result.apiMetrics.decimals,
                  result.apiMetrics.symbol,
                )}{" "}
                (
                {formatUsdAmount(
                  amountUsd(
                    plan.status === "insufficient-liquidity"
                      ? plan.available
                      : result.liquidity.total,
                    result.apiMetrics.decimals,
                    result.apiMetrics.priceUsd,
                  ),
                )}
                ).
              </p>
              <p className="mt-1 text-sm">{plan.message}</p>
            </div>
          )}

          <section className="rounded-lg bg-white p-4 shadow">
            <h2 className="mb-3 text-lg font-semibold">
              V2 allocator candidates
            </h2>
            {result.candidates.length === 0 ? (
              <p className="text-sm text-gray-500">
                No V2 allocator candidates are configured for this market.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b text-gray-500">
                    <tr>
                      <th className="p-2">Vault</th>
                      <th className="p-2">Adapter</th>
                      <th className="p-2">Penalty</th>
                      <th className="p-2">Pull from market</th>
                      <th className="p-2">Pull from idle</th>
                      <th className="p-2">Absolute cap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.candidates.map((candidate) => (
                      <tr
                        className="border-b last:border-0"
                        key={`${candidate.vault}-${candidate.adapter}-${candidate.capId}`}
                      >
                        <td className="p-2">
                          <a
                            className="text-blue-600 underline"
                            href={formatVaultLink(candidate.vault, networkId)}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {candidate.vault.slice(0, 8)}…
                            {candidate.vault.slice(-6)}
                          </a>
                        </td>
                        <td className="p-2 font-mono">
                          {candidate.adapter.slice(0, 8)}…
                          {candidate.adapter.slice(-6)}
                        </td>
                        <td className="p-2">{formatWAD(candidate.penalty)}</td>
                        <td className="p-2">
                          {candidate.canPullFromMarket ? "Yes" : "No"}
                        </td>
                        <td className="p-2">
                          {candidate.canPullFromIdle ? "Yes" : "No"}
                        </td>
                        <td className="p-2">
                          {displayAmount(
                            candidate.absoluteCap,
                            result.apiMetrics.decimals,
                            result.apiMetrics.symbol,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {series && (
            <section>
              {series.error && (
                <p className="mb-2 rounded bg-red-50 p-3 text-sm text-red-700">
                  {series.error}
                </p>
              )}
              {series.warning && (
                <p className="mb-2 rounded bg-amber-50 p-3 text-sm text-amber-800">
                  {series.warning}
                </p>
              )}
              <MarketMetricsChart
                loading={false}
                marketAsset={{
                  loanAsset: {
                    address: result.apiMetrics.loanAsset.address,
                    decimals: result.apiMetrics.decimals,
                    symbol: result.apiMetrics.symbol,
                    priceUsd: result.apiMetrics.priceUsd,
                  },
                  collateralAsset: {
                    address: result.apiMetrics.collateralAsset.address,
                    symbol: result.apiMetrics.collateralAsset.symbol,
                  },
                }}
                onUseMaxAvailable={() => {
                  setBorrowAmount(
                    formatUnits(result.liquidity.total, result.apiMetrics.decimals),
                  );
                }}
                simulationSeries={series}
              />
            </section>
          )}

          {!isPlanError && (
            <section className="rounded-lg bg-white p-4 shadow">
              <h2 className="mb-2 text-lg font-semibold">
                Reallocation Execution
              </h2>
              <p className="mb-4 text-sm text-gray-600">
                Reallocation-only: moves liquidity into this market; it does not
                borrow. Penalty is paid in {result.apiMetrics.symbol} from your
                wallet.
              </p>
              {sourceImpacts.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No reallocation is required for this amount.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] text-left text-sm">
                      <thead className="border-b text-gray-500">
                        <tr>
                          <th className="p-2">Vault</th>
                          <th className="p-2">Source</th>
                          <th className="p-2">Planned assets</th>
                          <th className="p-2">Penalty</th>
                          <th className="p-2">Penalty assets</th>
                          <th className="p-2">Send amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sourceImpacts.map((impact) => {
                          const planned = plan?.status === "reallocations"
                            ? plan.reallocations.find(
                                (entry) => reallocationKey(entry) === impact.key,
                              )
                            : undefined;
                          if (!planned) return null;
                          return (
                            <tr className="border-b last:border-0" key={impact.key}>
                              <td className="p-2">
                                <a
                                  className="text-blue-600 underline"
                                  href={formatVaultLink(impact.vault, networkId)}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  {impact.vault.slice(0, 8)}…
                                  {impact.vault.slice(-6)}
                                </a>
                              </td>
                              <td className="p-2">
                                {impact.source.type === "idle" ? (
                                  "Vault idle"
                                ) : (
                                  <a
                                    className="text-blue-600 underline"
                                    href={formatMarketLink(
                                      impact.source.marketId,
                                      networkId,
                                    )}
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    {impact.source.marketId.slice(0, 10)}…
                                  </a>
                                )}
                              </td>
                              <td className="p-2">
                                {displayAmount(
                                  impact.assets,
                                  result.apiMetrics.decimals,
                                  result.apiMetrics.symbol,
                                )}
                              </td>
                              <td className="p-2">{formatWAD(impact.penalty)}</td>
                              <td className="p-2">
                                {displayAmount(
                                  getPenaltyAssets({
                                    ...planned,
                                    assets:
                                      editedAmounts[impact.key] ??
                                      planned.assets,
                                  }),
                                  result.apiMetrics.decimals,
                                  result.apiMetrics.symbol,
                                )}
                              </td>
                              <td className="p-2">
                                <AmountInput
                                  maxValue={formatUnits(
                                    planned.assets,
                                    result.apiMetrics.decimals,
                                  )}
                                  onChange={(value) =>
                                    setEditedAmount(
                                      impact.key,
                                      value,
                                      result.apiMetrics.decimals,
                                    )
                                  }
                                  decimals={result.apiMetrics.decimals}
                                  symbol={result.apiMetrics.symbol}
                                  value={formatUnits(
                                    editedAmounts[impact.key] ?? planned.assets,
                                    result.apiMetrics.decimals,
                                  )}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-end gap-3">
                    <TransactionSimulatorV2
                      networkId={networkId}
                      reallocations={planReallocations}
                      targetMarketParams={result.marketParams}
                    />
                    <TransactionSenderV2
                      networkId={networkId}
                      reallocations={planReallocations}
                      targetMarketParams={result.marketParams}
                    />
                  </div>
                </>
              )}
            </section>
          )}

          {result.simulation && (
            <section className="rounded-lg bg-white p-4 shadow">
              <h2 className="mb-3 text-lg font-semibold">Market simulation</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b text-gray-500">
                    <tr>
                      <th className="p-2">Market</th>
                      <th className="p-2">Liquidity before</th>
                      <th className="p-2">Reallocated</th>
                      <th className="p-2">Liquidity after</th>
                      <th className="p-2">Borrow APY</th>
                      <th className="p-2">Utilization</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-2">
                        <a
                          className="text-blue-600 underline"
                          href={formatMarketLink(marketId, networkId)}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Target market
                        </a>
                      </td>
                      <td className="p-2">
                        {displayAmount(
                          result.simulation.targetMarket.preReallocation
                            .liquidity,
                          result.apiMetrics.decimals,
                          result.apiMetrics.symbol,
                        )}
                      </td>
                      <td className="p-2">
                        {displayAmount(
                          result.simulation.targetMarket.postReallocation
                            .reallocatedAmount,
                          result.apiMetrics.decimals,
                          result.apiMetrics.symbol,
                        )}
                      </td>
                      <td className="p-2">
                        {displayAmount(
                          result.simulation.targetMarket.postBorrow.liquidity,
                          result.apiMetrics.decimals,
                          result.apiMetrics.symbol,
                        )}
                      </td>
                      <td className="p-2">
                        {(
                          Number(
                            result.simulation.targetMarket.postBorrow.borrowApy,
                          ) / 1e16
                        ).toFixed(2)}
                        %
                      </td>
                      <td className="p-2">
                        {(
                          Number(
                            result.simulation.targetMarket.postBorrow
                              .utilization,
                          ) / 1e16
                        ).toFixed(2)}
                        %
                      </td>
                    </tr>
                    {Object.entries(result.simulation.sourceMarkets).map(
                      ([sourceMarketId, source]) => (
                        <tr
                          className="border-b last:border-0"
                          key={sourceMarketId}
                        >
                          <td className="p-2">
                            <a
                              className="text-blue-600 underline"
                              href={formatMarketLink(
                                sourceMarketId,
                                networkId,
                              )}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Source {sourceMarketId.slice(0, 10)}…
                            </a>
                          </td>
                          <td className="p-2">
                            {displayAmount(
                              source.preReallocation.liquidity,
                              result.apiMetrics.decimals,
                              result.apiMetrics.symbol,
                            )}
                          </td>
                          <td className="p-2">
                            {displayAmount(
                              source.postReallocation.reallocatedAmount,
                              result.apiMetrics.decimals,
                              result.apiMetrics.symbol,
                            )}
                          </td>
                          <td className="p-2">
                            {displayAmount(
                              source.postReallocation.liquidity,
                              result.apiMetrics.decimals,
                              result.apiMetrics.symbol,
                            )}
                          </td>
                          <td className="p-2">
                            {(
                              Number(source.postReallocation.borrowApy) / 1e16
                            ).toFixed(2)}
                            %
                          </td>
                          <td className="p-2">
                            {(
                              Number(source.postReallocation.utilization) /
                              1e16
                            ).toFixed(2)}
                            %
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
};

export default ManualReallocationPage;

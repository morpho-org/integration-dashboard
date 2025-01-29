import React, { useState, useEffect } from "react";
import {
  compareAndReallocate,
  ReallocationResult,
} from "../core/publicAllocator"; // Update with correct path
import { ChainId, MarketId } from "@morpho-org/blue-sdk";
import { formatUnits } from "viem";
import {
  formatMarketLink,
  formatUsdAmount,
  formatVaultLink,
  getMarketName,
} from "../utils/utils";
import {
  NetworkSelector,
  NetworkButton,
  ethLogo,
  baseLogo,
} from "../components/NavBar";

const SimpleCard = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-[#1a1d1f] text-white">
    <h3 className="text-lg font-medium mb-2">{title}</h3>
    {children}
  </div>
);

const SimpleAlert = ({
  message,
  type = "error",
}: {
  message: string;
  type?: string;
}) => (
  <div
    className={`p-4 mb-4 rounded-lg ${
      type === "error" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
    }`}
  >
    {message}
  </div>
);

// Add Props interface to fix TypeScript error
interface ManualReallocationPageProps {
  network: "ethereum" | "base";
}

const formatUsdWithStyle = (amount: string) => (
  <span className="text-l text-blue-500">
    {amount.slice(0, -1)}
    <span className="text-gray-400">{amount.slice(-1)}</span>
  </span>
);

const formatBorrowApyWithStyle = (apy: string) => (
  <span className="text-l text-blue-500">
    {apy}
    <span className="text-gray-400">%</span>
  </span>
);

const ManualReallocationPage: React.FC<ManualReallocationPageProps> = ({
  network,
}) => {
  const [inputs, setInputs] = useState({
    marketId:
      "0xd0e50cdac92fe2172043f5e0c36532c6369d24947e40968f34a5e8819ca9ec5d",
    chainId: network === "ethereum" ? "1" : "8453",
    requestedLiquidity: "10",
  });
  const [loading, setLoading] = useState(false);
  const [inputLoading, setInputLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReallocationResult | null>(null);

  // Add useEffect to update chainId when network prop changes
  useEffect(() => {
    setInputs((prev) => ({
      ...prev,
      chainId: network === "ethereum" ? "1" : "8453",
    }));
    setResult(null);
    setError(null);
  }, [network]);

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Add formatting for requestedLiquidity input
    if (name === "requestedLiquidity") {
      // Remove any non-digit characters
      const numericValue = value.replace(/[^\d]/g, "");
      // Add thousand separators
      const formattedValue = numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      setInputs((prev) => ({ ...prev, [name]: formattedValue }));
    } else {
      setInputs((prev) => ({ ...prev, [name]: value }));
    }
    setResult(null);
    setError(null);
    setInputLoading(true);

    setTimeout(() => {
      setInputLoading(false);
    }, 500);
  };

  const handleNetworkChange = (chainId: string) => {
    setInputs((prev) => ({ ...prev, chainId }));
    setResult(null);
    setError(null);
    setInputLoading(true);

    setTimeout(() => {
      setInputLoading(false);
    }, 500);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      // Remove thousand separators before processing
      const numericValue = inputs.requestedLiquidity.replace(/,/g, "");
      const res = await compareAndReallocate(
        inputs.marketId as MarketId,
        Number(inputs.chainId) as ChainId,
        BigInt(numericValue)
      );
      setResult(res);
    } catch (err) {
      console.error("Error in handleSubmit:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Manual Reallocation</h1>
        {result && result.reason && (
          <div
            className={`px-4 py-2 rounded-lg flex items-center ${
              result.reason.type === "success"
                ? "bg-green-400/10 text-green-400"
                : "bg-red-400/10 text-red-400"
            }`}
          >
            <span className="mr-2">
              {result.reason.type === "success" ? "✓" : "✗"}
            </span>
            {result.reason.message}
          </div>
        )}
      </div>

      <div className="flex gap-6">
        {/* Left side - Input form */}
        <div className="w-1/4">
          <SimpleCard title="Input Parameters">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Market ID
                </label>
                <input
                  type="text"
                  name="marketId"
                  value={inputs.marketId}
                  onChange={handleInputChange}
                  className="w-full p-2 rounded bg-gray-800 text-xs"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Chain ID
                </label>
                <div className="flex justify-center">
                  <NetworkSelector className="inline-flex w-full rounded-lg overflow-hidden">
                    <NetworkButton
                      className="flex-1 px-4 py-2 border-r border-gray-700"
                      $isActive={inputs.chainId === "1"}
                      onClick={() => handleNetworkChange("1")}
                    >
                      <div className="flex items-center justify-center">
                        <img
                          src={ethLogo}
                          alt="Ethereum"
                          className="w-5 h-5 mr-2"
                        />
                        Ethereum
                      </div>
                    </NetworkButton>
                    <NetworkButton
                      className="flex-1 px-4 py-2"
                      $isActive={inputs.chainId === "8453"}
                      onClick={() => handleNetworkChange("8453")}
                    >
                      <div className="flex items-center justify-center">
                        <img
                          src={baseLogo}
                          alt="Base"
                          className="w-5 h-5 mr-2"
                        />
                        Base
                      </div>
                    </NetworkButton>
                  </NetworkSelector>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Borrow Request Liquidity (native units)
                </label>
                <input
                  type="text"
                  name="requestedLiquidity"
                  value={inputs.requestedLiquidity}
                  onChange={handleInputChange}
                  className="w-full p-2 rounded bg-gray-800 text-xs"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:bg-gray-300"
              >
                {loading ? "Computing..." : "Compute Reallocation"}
              </button>

              {result && result.apiMetrics && (
                <div className="mt-4 p-3 bg-gray-800 rounded-lg text-sm">
                  <p className="text-gray-300">
                    Token:{" "}
                    <span className="text-blue-400">
                      {result.apiMetrics.symbol}
                    </span>
                  </p>
                  <p className="text-gray-300">
                    Price:{" "}
                    <span className="text-blue-400">
                      ${result.apiMetrics.priceUsd.toFixed(2)}
                    </span>
                  </p>
                  <p className="text-gray-300">
                    Decimals:{" "}
                    <span className="text-blue-400">
                      {result.apiMetrics.decimals}
                    </span>
                  </p>
                  <p className="text-gray-300">
                    Requested Amount:{" "}
                    <span className="text-blue-400">
                      {formatUsdWithStyle(
                        formatUsdAmount(
                          Number(inputs.requestedLiquidity) *
                            result.apiMetrics.priceUsd
                        )
                      )}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </SimpleCard>
        </div>

        {/* Right side - Results */}
        <div className="w-3/4">
          {(loading || inputLoading) && (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          )}

          {!loading && !inputLoading && (
            <>
              {error && (
                <SimpleAlert
                  message={
                    error +
                    "... are you sure you selected the right network id?"
                  }
                />
              )}

              {result && (
                <div className="space-y-4">
                  {result.reallocation && (
                    <SimpleCard title="Reallocation Details">
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <h4 className="text-sm text-gray-400 mb-1">
                            Liquidity Needed
                          </h4>
                          {formatUsdWithStyle(
                            formatUsdAmount(
                              Number(
                                formatUnits(
                                  result.reallocation
                                    .liquidityNeededFromReallocation,
                                  result.apiMetrics.decimals
                                )
                              ) * result.apiMetrics.priceUsd,
                              2
                            )
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm text-gray-400 mb-1">
                            Reallocatable Liquidity
                          </h4>
                          {formatUsdWithStyle(
                            formatUsdAmount(
                              Number(
                                formatUnits(
                                  result.reallocation.reallocatableLiquidity,
                                  result.apiMetrics.decimals
                                )
                              ) * result.apiMetrics.priceUsd,
                              2
                            )
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm text-gray-400 mb-1">
                            Fully Matched
                          </h4>
                          <span className="text-l">
                            {result.reallocation.isLiquidityFullyMatched
                              ? "Yes ✅"
                              : "No ❌"}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm text-gray-400 mb-1">
                            Shortfall
                          </h4>
                          {formatUsdWithStyle(
                            formatUsdAmount(
                              Number(
                                formatUnits(
                                  result.reallocation.liquidityShortfall,
                                  result.apiMetrics.decimals
                                )
                              ) * result.apiMetrics.priceUsd,
                              2
                            )
                          )}
                        </div>
                      </div>
                    </SimpleCard>
                  )}
                  <SimpleCard title="Market Metrics">
                    <div className="space-y-6">
                      {/* Target Market Section */}
                      <div>
                        <h3 className="text-lg font-medium text-blue-400 mb-4 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span>Target Market:</span>
                            <span className="text-sm text-gray-300">
                              <a
                                href={formatMarketLink(
                                  inputs.marketId,
                                  Number(inputs.chainId)
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-gray-300 hover:text-blue-400"
                              >
                                {getMarketName(
                                  result.apiMetrics.loanAsset.symbol,
                                  result.apiMetrics.collateralAsset
                                    ? result.apiMetrics.collateralAsset.symbol
                                    : null,
                                  result.apiMetrics.lltv
                                )}
                              </a>
                            </span>
                          </div>
                        </h3>
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-gray-400 mb-1">
                              Current Market Liq.
                            </p>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center">
                                <span className="text-gray-400 text-sm w-16">
                                  - api
                                </span>
                                {formatUsdWithStyle(
                                  formatUsdAmount(
                                    Number(
                                      formatUnits(
                                        result.apiMetrics
                                          .currentMarketLiquidity,
                                        result.apiMetrics.decimals
                                      )
                                    ) * result.apiMetrics.priceUsd,
                                    2
                                  )
                                )}
                              </div>
                              <div className="flex items-center">
                                <span className="text-gray-400 text-sm w-16">
                                  - onchain
                                </span>
                                {formatUsdWithStyle(
                                  formatUsdAmount(
                                    Number(
                                      formatUnits(
                                        result.currentMarketLiquidity,
                                        result.apiMetrics.decimals
                                      )
                                    ) * result.apiMetrics.priceUsd,
                                    2
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-gray-400 mb-1">
                              Reallocatable Liq. from API
                            </p>
                            {formatUsdWithStyle(
                              formatUsdAmount(
                                Number(
                                  formatUnits(
                                    result.apiMetrics.reallocatableLiquidity,
                                    result.apiMetrics.decimals
                                  )
                                ) * result.apiMetrics.priceUsd,
                                2
                              )
                            )}
                          </div>
                          <div>
                            <p className="text-sm text-gray-400 mb-1">
                              Total Available Liq.
                            </p>
                            {formatUsdWithStyle(
                              formatUsdAmount(
                                Number(
                                  formatUnits(
                                    BigInt(
                                      Number(
                                        result.apiMetrics.currentMarketLiquidity
                                      ) +
                                        Number(
                                          result.apiMetrics
                                            .reallocatableLiquidity
                                        )
                                    ),
                                    result.apiMetrics.decimals
                                  )
                                ) * result.apiMetrics.priceUsd,
                                2
                              )
                            )}
                          </div>
                          {result.apiMetrics.maxBorrowWithoutReallocation ? (
                            <div className="text-sm text-gray-400">
                              <p className="text-sm text-gray-400 mb-1">
                                Max Borrow no reallocation:
                              </p>
                              <div>
                                {Number(
                                  formatUnits(
                                    result.apiMetrics
                                      .maxBorrowWithoutReallocation,
                                    result.apiMetrics.decimals
                                  )
                                ).toFixed(2)}{" "}
                                units →{" "}
                                {formatUsdWithStyle(
                                  formatUsdAmount(
                                    Number(
                                      formatUnits(
                                        result.apiMetrics
                                          .maxBorrowWithoutReallocation,
                                        result.apiMetrics.decimals
                                      )
                                    ) * result.apiMetrics.priceUsd,
                                    2
                                  )
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {/* Source Markets Section */}
                      <div>
                        <h3 className="text-lg font-medium text-blue-400 mb-2">
                          Source Markets
                        </h3>
                        {/* Add column headers */}
                        <div className="grid grid-cols-4 gap-2 mb-2 px-2">
                          <div className="text-xs text-gray-500">Vault</div>
                          <div className="text-xs text-gray-500">Markets</div>
                          <div className="text-xs text-gray-500">
                            Reallocatable Liq.
                          </div>
                          <div className="text-xs text-gray-500 whitespace-nowrap">
                            Utilization / Withdraw Targets
                          </div>
                        </div>
                        <div className="space-y-2">
                          {Object.entries(
                            result.apiMetrics.publicAllocatorSharedLiquidity.reduce(
                              (acc, item) => {
                                const vaultName = item.vault.name;
                                if (!acc[vaultName]) {
                                  acc[vaultName] = {
                                    markets: [],
                                    vaultAddress: item.vault.address,
                                  };
                                }
                                acc[vaultName].markets.push(item);
                                return acc;
                              },
                              {} as Record<
                                string,
                                {
                                  markets: typeof result.apiMetrics.publicAllocatorSharedLiquidity;
                                  vaultAddress: string;
                                }
                              >
                            )
                          ).map(([vaultName, data]) => (
                            <div
                              key={vaultName}
                              className="bg-gray-800/50 rounded-lg p-2 hover:bg-gray-800/70 transition-colors"
                            >
                              <div className="grid grid-cols-4 gap-2">
                                <div>
                                  <p className="text-sm text-white">
                                    <a
                                      href={formatVaultLink(
                                        data.vaultAddress,
                                        Number(inputs.chainId)
                                      )}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-gray-300 hover:text-blue-400"
                                    >
                                      {vaultName}
                                    </a>
                                  </p>
                                </div>
                                <div>
                                  {data.markets.map((market) => (
                                    <a
                                      key={market.allocationMarket.uniqueKey}
                                      href={formatMarketLink(
                                        market.allocationMarket.uniqueKey,
                                        Number(inputs.chainId)
                                      )}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block text-sm text-white hover:text-blue-400"
                                    >
                                      {`${getMarketName(
                                        market.allocationMarket.loanAsset
                                          .symbol,
                                        market.allocationMarket.collateralAsset
                                          ? market.allocationMarket
                                              .collateralAsset.symbol
                                          : null,
                                        BigInt(market.allocationMarket.lltv)
                                      )}`}
                                    </a>
                                  ))}
                                </div>
                                <div>
                                  {data.markets.map((market) => (
                                    <p
                                      key={market.allocationMarket.uniqueKey}
                                      className="text-sm text-white"
                                    >
                                      {formatUsdWithStyle(
                                        formatUsdAmount(
                                          Number(
                                            formatUnits(
                                              BigInt(market.assets),
                                              result.apiMetrics.decimals
                                            )
                                          ) * result.apiMetrics.priceUsd,
                                          2
                                        )
                                      )}
                                    </p>
                                  ))}
                                </div>
                                {/* Modified utilization metrics column */}
                                <div>
                                  {data.markets.map((market) => (
                                    <p
                                      key={market.allocationMarket.uniqueKey}
                                      className="text-sm text-gray-400"
                                    >
                                      {(
                                        market.allocationMarket.state
                                          .utilization * 100
                                      ).toFixed(2)}
                                      % /{" "}
                                      {(
                                        Number(
                                          formatUnits(
                                            BigInt(
                                              market.allocationMarket
                                                .targetWithdrawUtilization
                                            ),
                                            18
                                          )
                                        ) * 100
                                      ).toFixed(2)}
                                      %
                                    </p>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </SimpleCard>

                  {result.simulation && (
                    <SimpleCard title="Simulation Results">
                      <div className="space-y-6">
                        {/* Column Headers */}
                        <div className="grid grid-cols-6 gap-4">
                          <div className="text-sm font-medium text-gray-400">
                            Market
                          </div>
                          <div className="text-sm font-medium text-gray-400">
                            Metric
                          </div>
                          <div className="text-sm font-medium text-gray-400">
                            Pre-Reallocation
                          </div>
                          <div className="text-sm font-medium text-gray-400">
                            Post-Reallocation
                          </div>
                          <div className="text-sm font-medium text-gray-400">
                            Post-Borrow
                          </div>
                        </div>

                        {/* Target Market Data */}
                        <div>
                          <div className="text-sm font-medium text-blue-400 mb-2">
                            Target Market
                          </div>
                          <div className="grid grid-cols-6 gap-4">
                            <div>
                              <a
                                href={formatMarketLink(
                                  inputs.marketId,
                                  Number(inputs.chainId)
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-gray-300 hover:text-blue-400"
                              >
                                {`${getMarketName(
                                  result.apiMetrics.loanAsset.symbol,
                                  result.apiMetrics.collateralAsset
                                    ? result.apiMetrics.collateralAsset.symbol
                                    : null,
                                  result.apiMetrics.lltv
                                )}`}
                              </a>
                            </div>
                            <div className="space-y-2">
                              <div className="text-sm text-gray-400">
                                Liquidity
                              </div>
                              <div className="text-sm text-gray-400">
                                Borrow APY
                              </div>
                              <div className="text-sm text-gray-400">
                                Utilization
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div>
                                {formatUsdWithStyle(
                                  formatUsdAmount(
                                    Number(
                                      formatUnits(
                                        result.simulation.targetMarket
                                          .preReallocation.liquidity,
                                        result.apiMetrics.decimals
                                      )
                                    ) * result.apiMetrics.priceUsd,
                                    2
                                  )
                                )}
                              </div>
                              <div>
                                {formatBorrowApyWithStyle(
                                  Number(
                                    formatUnits(
                                      result.simulation.targetMarket
                                        .preReallocation.borrowApy,
                                      16
                                    )
                                  ).toFixed(2)
                                )}
                              </div>
                              <div>
                                {formatBorrowApyWithStyle(
                                  Number(
                                    formatUnits(
                                      result.simulation.targetMarket
                                        .preReallocation.utilization,
                                      16
                                    )
                                  ).toFixed(2)
                                )}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div>
                                {formatUsdWithStyle(
                                  formatUsdAmount(
                                    Number(
                                      formatUnits(
                                        result.simulation.targetMarket
                                          .postReallocation.liquidity,
                                        result.apiMetrics.decimals
                                      )
                                    ) * result.apiMetrics.priceUsd,
                                    2
                                  )
                                )}
                              </div>
                              <div>
                                {formatBorrowApyWithStyle(
                                  Number(
                                    formatUnits(
                                      result.simulation.targetMarket
                                        .postReallocation.borrowApy,
                                      16
                                    )
                                  ).toFixed(2)
                                )}
                              </div>
                              <div>
                                {formatBorrowApyWithStyle(
                                  Number(
                                    formatUnits(
                                      result.simulation.targetMarket
                                        .postReallocation.utilization,
                                      16
                                    )
                                  ).toFixed(2)
                                )}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div>
                                {formatUsdWithStyle(
                                  formatUsdAmount(
                                    Number(
                                      formatUnits(
                                        result.simulation.targetMarket
                                          .postBorrow.liquidity,
                                        result.apiMetrics.decimals
                                      )
                                    ) * result.apiMetrics.priceUsd,
                                    2
                                  )
                                )}
                              </div>
                              <div>
                                {formatBorrowApyWithStyle(
                                  Number(
                                    formatUnits(
                                      result.simulation.targetMarket.postBorrow
                                        .borrowApy,
                                      16
                                    )
                                  ).toFixed(2)
                                )}
                              </div>
                              <div>
                                {formatBorrowApyWithStyle(
                                  Number(
                                    formatUnits(
                                      result.simulation.targetMarket.postBorrow
                                        .utilization,
                                      16
                                    )
                                  ).toFixed(2)
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* Source Markets Section - Simulation Results */}
                        <div>
                          <h3 className="text-lg font-medium text-blue-400 mb-2">
                            Source Markets
                          </h3>
                          {/* Add column headers */}
                          <div className="grid grid-cols-5 gap-2 mb-2 px-2">
                            <div className="text-xs text-gray-500">Vault</div>
                            <div className="text-xs text-gray-500">Markets</div>
                            <div className="text-xs text-gray-500">
                              Reallocatable Liq.
                            </div>
                            <div className="text-xs text-gray-500">
                              Borrow APY
                            </div>
                            <div className="text-xs text-gray-500 whitespace-nowrap">
                              Utilization
                            </div>
                          </div>
                          <div className="space-y-2">
                            {Object.entries(
                              result.apiMetrics.publicAllocatorSharedLiquidity.reduce(
                                (acc, item) => {
                                  const vaultName = item.vault.name;
                                  if (!acc[vaultName]) {
                                    acc[vaultName] = {
                                      markets: [],
                                      vaultAddress: item.vault.address,
                                    };
                                  }
                                  acc[vaultName].markets.push(item);
                                  return acc;
                                },
                                {} as Record<
                                  string,
                                  {
                                    markets: typeof result.apiMetrics.publicAllocatorSharedLiquidity;
                                    vaultAddress: string;
                                  }
                                >
                              )
                            ).map(([vaultName, data]) => (
                              <div
                                key={vaultName}
                                className="bg-gray-800/50 rounded-lg p-2 hover:bg-gray-800/70 transition-colors"
                              >
                                <div className="grid grid-cols-5 gap-2">
                                  <div>
                                    <p className="text-sm text-white">
                                      <a
                                        href={formatVaultLink(
                                          data.vaultAddress,
                                          Number(inputs.chainId)
                                        )}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-gray-300 hover:text-blue-400"
                                      >
                                        {vaultName}
                                      </a>
                                    </p>
                                  </div>
                                  <div>
                                    {data.markets.map((market) => (
                                      <a
                                        key={market.allocationMarket.uniqueKey}
                                        href={formatMarketLink(
                                          market.allocationMarket.uniqueKey,
                                          Number(inputs.chainId)
                                        )}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block text-sm text-white hover:text-blue-400"
                                      >
                                        {`${getMarketName(
                                          market.allocationMarket.loanAsset
                                            .symbol,
                                          market.allocationMarket
                                            .collateralAsset
                                            ? market.allocationMarket
                                                .collateralAsset.symbol
                                            : null,
                                          BigInt(market.allocationMarket.lltv)
                                        )}`}
                                      </a>
                                    ))}
                                  </div>
                                  {/* Reallocatable Liquidity column with arrows */}
                                  <div>
                                    {data.markets.map((market) => {
                                      const simulationData =
                                        result.simulation?.sourceMarkets[
                                          market.allocationMarket.uniqueKey
                                        ];
                                      const isImpacted = !!simulationData;
                                      return (
                                        <div
                                          key={
                                            market.allocationMarket.uniqueKey
                                          }
                                          className="flex items-center"
                                        >
                                          <span
                                            className={`text-sm ${
                                              isImpacted
                                                ? "text-red-400"
                                                : "text-white"
                                            }`}
                                          >
                                            {formatUsdWithStyle(
                                              formatUsdAmount(
                                                Number(
                                                  formatUnits(
                                                    BigInt(market.assets),
                                                    result.apiMetrics.decimals
                                                  )
                                                ) * result.apiMetrics.priceUsd,
                                                2
                                              )
                                            )}
                                          </span>
                                          {isImpacted && (
                                            <span className="text-sm text-red-400 ml-2">
                                              →{" "}
                                              {formatUsdWithStyle(
                                                formatUsdAmount(
                                                  Number(
                                                    formatUnits(
                                                      simulationData
                                                        .postReallocation
                                                        .liquidity,
                                                      result.apiMetrics.decimals
                                                    )
                                                  ) *
                                                    result.apiMetrics.priceUsd,
                                                  2
                                                )
                                              )}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {/* New Borrow APY column */}
                                  <div>
                                    {data.markets.map((market) => {
                                      const simulationData =
                                        result.simulation?.sourceMarkets[
                                          market.allocationMarket.uniqueKey
                                        ];
                                      const isImpacted = !!simulationData;
                                      return (
                                        <div
                                          key={
                                            market.allocationMarket.uniqueKey
                                          }
                                          className="text-sm"
                                        >
                                          {isImpacted ? (
                                            <span className="text-red-400">
                                              {Number(
                                                formatUnits(
                                                  simulationData.preReallocation
                                                    .borrowApy,
                                                  16
                                                )
                                              ).toFixed(2)}
                                              % →{" "}
                                              {Number(
                                                formatUnits(
                                                  simulationData
                                                    .postReallocation.borrowApy,
                                                  16
                                                )
                                              ).toFixed(2)}
                                              %
                                            </span>
                                          ) : (
                                            <span className="text-white"></span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {/* Updated Utilization column */}
                                  <div>
                                    {data.markets.map((market) => {
                                      const simulationData =
                                        result.simulation?.sourceMarkets[
                                          market.allocationMarket.uniqueKey
                                        ];
                                      const isImpacted = !!simulationData;
                                      return (
                                        <p
                                          key={
                                            market.allocationMarket.uniqueKey
                                          }
                                          className="text-sm text-gray-400"
                                        >
                                          {isImpacted ? (
                                            <span className="text-red-400">
                                              {Number(
                                                formatUnits(
                                                  simulationData.preReallocation
                                                    .utilization,
                                                  16
                                                )
                                              ).toFixed(2)}
                                              % →{" "}
                                              {Number(
                                                formatUnits(
                                                  simulationData
                                                    .postReallocation
                                                    .utilization,
                                                  16
                                                )
                                              ).toFixed(2)}
                                              %
                                            </span>
                                          ) : (
                                            <span>
                                              {(
                                                market.allocationMarket.state
                                                  .utilization * 100
                                              ).toFixed(2)}
                                              %
                                            </span>
                                          )}
                                        </p>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Source Markets */}
                        <div>Detailed Below</div>
                        {Object.entries(result.simulation.sourceMarkets).map(
                          ([marketId, marketData]) => {
                            // Find matching market data from API metrics
                            const sourceMarketData =
                              result.apiMetrics.publicAllocatorSharedLiquidity.find(
                                (item) =>
                                  item.allocationMarket.uniqueKey === marketId
                              );

                            const marketName = sourceMarketData
                              ? getMarketName(
                                  sourceMarketData.allocationMarket.loanAsset
                                    .symbol,
                                  sourceMarketData.allocationMarket
                                    .collateralAsset
                                    ? sourceMarketData.allocationMarket
                                        .collateralAsset.symbol
                                    : null,
                                  BigInt(sourceMarketData.allocationMarket.lltv)
                                )
                              : `${marketId.slice(0, 6)}...${marketId.slice(
                                  -4
                                )}`;

                            return (
                              <div key={marketId}>
                                <div className="text-sm font-medium text-blue-400 mb-2">
                                  Source Market: {marketName}
                                </div>
                                <div className="grid grid-cols-6 gap-4">
                                  <div>
                                    <a
                                      href={formatMarketLink(
                                        marketId,
                                        Number(inputs.chainId)
                                      )}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-gray-300 hover:text-blue-400"
                                    >
                                      {marketName}
                                    </a>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="text-sm text-gray-400">
                                      Liquidity
                                    </div>
                                    <div className="text-sm text-gray-400">
                                      Borrow APY
                                    </div>
                                    <div className="text-sm text-gray-400">
                                      Utilization
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <div>
                                      {formatUsdWithStyle(
                                        formatUsdAmount(
                                          Number(
                                            formatUnits(
                                              marketData.preReallocation
                                                .liquidity,
                                              result.apiMetrics.decimals
                                            )
                                          ) * result.apiMetrics.priceUsd,
                                          2
                                        )
                                      )}
                                    </div>
                                    <div>
                                      {formatBorrowApyWithStyle(
                                        Number(
                                          formatUnits(
                                            marketData.preReallocation
                                              .borrowApy,
                                            16
                                          )
                                        ).toFixed(2)
                                      )}
                                    </div>
                                    <div>
                                      {formatBorrowApyWithStyle(
                                        Number(
                                          formatUnits(
                                            marketData.preReallocation
                                              .utilization,
                                            16
                                          )
                                        ).toFixed(2)
                                      )}
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <div>
                                      {formatUsdWithStyle(
                                        formatUsdAmount(
                                          Number(
                                            formatUnits(
                                              marketData.postReallocation
                                                .liquidity,
                                              result.apiMetrics.decimals
                                            )
                                          ) * result.apiMetrics.priceUsd,
                                          2
                                        )
                                      )}
                                    </div>
                                    <div>
                                      {formatBorrowApyWithStyle(
                                        Number(
                                          formatUnits(
                                            marketData.postReallocation
                                              .borrowApy,
                                            16
                                          )
                                        ).toFixed(2)
                                      )}
                                    </div>
                                    <div>
                                      {formatBorrowApyWithStyle(
                                        Number(
                                          formatUnits(
                                            marketData.postReallocation
                                              .utilization,
                                            16
                                          )
                                        ).toFixed(2)
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </SimpleCard>
                  )}

                  {result.rawTransaction && (
                    <SimpleCard title="Raw Transaction">
                      <div className="overflow-x-auto">
                        <pre className="text-sm">
                          {JSON.stringify(result.rawTransaction, null, 2)}
                        </pre>
                      </div>
                    </SimpleCard>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManualReallocationPage;

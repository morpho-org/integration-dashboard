import React, { useEffect, useRef, useState } from "react";
import { formatUnits } from "viem";
import { fetchAssetPriceDL } from "../fetchers/fetchDLPrice";
import { formatUsdAmount } from "../utils/utils"; // Make sure to update the import path if needed

interface MarketMetricsChartProps {
  simulationSeries: {
    percentages: number[];
    initialLiquidity: bigint;
    utilizationSeries: number[];
    apySeries: number[];
    borrowAmounts: bigint[];
  } | null;
  marketAsset: {
    loanAsset: any;
    collateralAsset: any;
  } | null;
  onUseMaxAvailable: () => void;
  loading: boolean;
}

const MarketMetricsChart: React.FC<MarketMetricsChartProps> = ({
  simulationSeries,
  marketAsset,
  onUseMaxAvailable,
  loading,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });
  const chartRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [assetPrice, setAssetPrice] = useState<number | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState<boolean>(false);

  // Fetch price from DefiLlama if marketAsset exists but priceUsd is null
  useEffect(() => {
    async function fetchPrice() {
      if (marketAsset?.loanAsset && !marketAsset.loanAsset.priceUsd) {
        try {
          setIsLoadingPrice(true);
          const chainId = (window as any).ethereum?.chainId
            ? parseInt((window as any).ethereum.chainId, 16)
            : 1; // Default to Ethereum mainnet

          const priceData = await fetchAssetPriceDL(
            marketAsset.loanAsset.address,
            chainId
          );

          if (priceData) {
            setAssetPrice(priceData.price);
          }
        } catch (error) {
          console.error("Failed to fetch price from DefiLlama:", error);
        } finally {
          setIsLoadingPrice(false);
        }
      }
    }

    fetchPrice();
  }, [marketAsset]);

  if (loading || isLoadingPrice) {
    return (
      <div className="flex items-center justify-center p-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!simulationSeries) {
    return null;
  }

  // Normalize percentages to ensure first point is at x=0 and last point is at x=100
  const normalizedPercentages = [...simulationSeries.percentages];
  if (normalizedPercentages[0] !== 0) {
    normalizedPercentages[0] = 0;
  }
  if (normalizedPercentages[normalizedPercentages.length - 1] !== 100) {
    normalizedPercentages[normalizedPercentages.length - 1] = 100;
  }

  // Find the actual indices for our x-axis labels to ensure correct alignment
  const percentageMarkers = [0, 25, 50, 75, 100];
  const markerIndices = percentageMarkers.map((p) => {
    if (p === 0) return 0;
    if (p === 100) return simulationSeries.percentages.length - 1;

    // Find closest index to the marker percentage
    let closestIndex = 0;
    let minDistance = Number.MAX_VALUE;
    for (let i = 0; i < normalizedPercentages.length; i++) {
      const distance = Math.abs(normalizedPercentages[i] - p);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }
    return closestIndex;
  });

  // Get effective price (use DefiLlama price as fallback)
  const effectivePrice = marketAsset?.loanAsset.priceUsd || assetPrice || 0;
  const hasPriceData = effectivePrice > 0;

  // Utility to format the borrow amount nicely
  const getFormattedBorrowAmount = (amount: bigint) => {
    if (!marketAsset) return "Loading...";
    const nativeAmount = Number(
      formatUnits(amount, marketAsset.loanAsset.decimals || 18)
    );
    const usdAmount = nativeAmount * effectivePrice;
    return hasPriceData
      ? formatUsdAmount(usdAmount, 1)
      : `${nativeAmount.toFixed(2)} ${marketAsset.loanAsset.symbol || ""}`;
  };

  // Handle mouse movement over the chart area
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!svgRef.current || !chartRef.current || !simulationSeries) return;

    const svgRect = svgRef.current.getBoundingClientRect();
    const chartRect = chartRef.current.getBoundingClientRect();

    // Calculate mouse position relative to SVG
    const mouseX = e.clientX - svgRect.left;
    const relativeX = (mouseX / svgRect.width) * 100; // Convert to viewBox coordinates (0-100)

    // Find the closest point based on x-coordinate
    let closestPointIndex = 0;
    let minDistance = Number.MAX_VALUE;

    normalizedPercentages.forEach((p, i) => {
      const distance = Math.abs(p - relativeX);
      if (distance < minDistance) {
        minDistance = distance;
        closestPointIndex = i;
      }
    });

    // Set the hovered point
    setHoveredPoint(closestPointIndex);

    // Calculate tooltip position in pixels
    const x = (normalizedPercentages[closestPointIndex] / 100) * svgRect.width;
    const y =
      ((viewBoxHeight -
        (simulationSeries.apySeries[closestPointIndex] / maxYScale) *
          viewBoxHeight) /
        viewBoxHeight) *
      (chartRect.height - 24);

    setTooltipPosition({ x, y });
  };

  // Handle mouse leave from the chart area
  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  const maxApyValue = Math.max(...simulationSeries.apySeries);
  const maxYScale = Math.ceil(maxApyValue * 1.1);
  const viewBoxHeight = Math.max(50, (maxYScale / 20) * 50);

  return (
    <div className="p-3 bg-gray-800/50 rounded-lg text-sm">
      {!hasPriceData ? (
        <div className="p-2 bg-yellow-400/10 text-yellow-400 text-xs rounded">
          ⚠️ Price data unavailable for this market on the current chain. Some
          USD values may not display correctly.
        </div>
      ) : simulationSeries.utilizationSeries.every((u) => u === 0) ? (
        <div className="p-2 bg-yellow-400/10 text-yellow-400 text-xs rounded">
          ⚠️ This market does not exist on the current chain. Try switching
          networks.
        </div>
      ) : (
        <>
          {/* SVG Chart */}
          <div className="relative h-56 mt-4" ref={chartRef}>
            {/* Legend in top left */}
            <div className="absolute top-0 left-0 z-10 text-xs text-gray-400 bg-gray-900 bg-opacity-70 px-2 py-1 rounded  ml-4">
              <div className="flex items-center">
                <span className="w-3 h-0.5 bg-blue-500 mr-1"></span>
                <span>
                  Borrow APY in function of the future borrow liquidity
                </span>
              </div>
            </div>

            {/* Hovered point info in bottom right */}
            {hoveredPoint !== null && (
              <div className="absolute bottom-8 right-0 z-10 text-xs text-gray-300 bg-gray-900 bg-opacity-70 px-2 py-1 rounded text-right">
                <div>{normalizedPercentages[hoveredPoint].toFixed(2)}%</div>
                <div className="text-blue-400">
                  {simulationSeries.apySeries[hoveredPoint].toFixed(2)}% APY
                </div>
              </div>
            )}

            <svg
              ref={svgRef}
              className="w-full h-[calc(100%-24px)]"
              viewBox={`0 0 100 ${viewBoxHeight}`}
              preserveAspectRatio="none"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              {/* Invisible overlay for mouse tracking */}
              <rect
                x="0"
                y="0"
                width="100"
                height={viewBoxHeight}
                fill="transparent"
              />

              {/* Grid lines */}
              <line
                x1="0"
                y1={viewBoxHeight / 2}
                x2="100"
                y2={viewBoxHeight / 2}
                stroke="#2D3748"
                strokeWidth="0.3"
              />
              <line
                x1="25"
                y1="0"
                x2="25"
                y2={viewBoxHeight}
                stroke="#2D3748"
                strokeWidth="0.3"
              />
              <line
                x1="50"
                y1="0"
                x2="50"
                y2={viewBoxHeight}
                stroke="#2D3748"
                strokeWidth="0.3"
              />
              <line
                x1="75"
                y1="0"
                x2="75"
                y2={viewBoxHeight}
                stroke="#2D3748"
                strokeWidth="0.3"
              />

              {/* Axes */}
              <line
                x1="0"
                y1={viewBoxHeight}
                x2="100"
                y2={viewBoxHeight}
                stroke="#6B7280"
                strokeWidth="0.3"
              />
              <line
                x1="0"
                y1="0"
                x2="0"
                y2={viewBoxHeight}
                stroke="#6B7280"
                strokeWidth="0.3"
              />

              {/* APY Line */}
              <polyline
                points={normalizedPercentages
                  .map(
                    (p, i) =>
                      `${p} ${
                        viewBoxHeight -
                        (simulationSeries.apySeries[i] / maxYScale) *
                          viewBoxHeight
                      }`
                  )
                  .join(" ")}
                fill="none"
                stroke="#3B82F6"
                strokeWidth="1"
              />

              {/* Data Points */}
              {normalizedPercentages.map(
                (p, i) =>
                  // Only render every 5th point and the hovered point
                  (i % 10 === 0 || hoveredPoint === i) && (
                    <circle
                      key={i}
                      cx={p}
                      cy={
                        viewBoxHeight -
                        (simulationSeries.apySeries[i] / maxYScale) *
                          viewBoxHeight
                      }
                      r={hoveredPoint === i ? "1.1" : "0.8"}
                      fill={hoveredPoint === i ? "#60A5FA" : "#3B82F6"}
                    />
                  )
              )}

              {/* Guide lines for hovered point */}
              {hoveredPoint !== null && (
                <>
                  {/* Vertical guide line */}
                  <line
                    x1={normalizedPercentages[hoveredPoint]}
                    y1={
                      viewBoxHeight -
                      (simulationSeries.apySeries[hoveredPoint] / maxYScale) *
                        viewBoxHeight
                    }
                    x2={normalizedPercentages[hoveredPoint]}
                    y2={viewBoxHeight}
                    stroke="#6B7280"
                    strokeWidth="0.3"
                    strokeDasharray="1,1"
                  />
                  {/* Horizontal guide line */}
                  <line
                    x1="0"
                    y1={
                      viewBoxHeight -
                      (simulationSeries.apySeries[hoveredPoint] / maxYScale) *
                        viewBoxHeight
                    }
                    x2={normalizedPercentages[hoveredPoint]}
                    y2={
                      viewBoxHeight -
                      (simulationSeries.apySeries[hoveredPoint] / maxYScale) *
                        viewBoxHeight
                    }
                    stroke="#6B7280"
                    strokeWidth="0.3"
                    strokeDasharray="1,1"
                  />
                </>
              )}
            </svg>

            {/* Floating Tooltip outside of SVG */}
            {hoveredPoint !== null && (
              <div
                className="absolute z-50 bg-black bg-opacity-90 text-white p-2 rounded border border-gray-600 shadow-lg text-xs"
                style={{
                  left: `${tooltipPosition.x}px`,
                  top: `${tooltipPosition.y - 40}px`,
                  transform: "translate(-50%, -80%)",
                  width: "150px",
                  pointerEvents: "none",
                }}
              >
                <div>
                  <strong>APY:</strong>{" "}
                  {simulationSeries.apySeries[hoveredPoint].toFixed(2)}%
                </div>
                <div>
                  <strong>Amount:</strong>{" "}
                  {marketAsset && simulationSeries.borrowAmounts
                    ? getFormattedBorrowAmount(
                        simulationSeries.borrowAmounts[hoveredPoint]
                      )
                    : "..."}
                </div>
                <div>
                  <strong>Util:</strong>{" "}
                  {simulationSeries.utilizationSeries[hoveredPoint].toFixed(2)}%
                </div>
              </div>
            )}

            {/* X-Axis Labels */}
            <div className="relative w-full h-8 mt-1">
              {percentageMarkers.map((p, i) => (
                <div
                  key={p}
                  className="absolute flex flex-col items-center transform -translate-x-1/2"
                  style={{ left: `${p}%`, width: "auto" }}
                >
                  <span className="text-xs text-gray-400">{p}%</span>
                  {marketAsset &&
                    simulationSeries.borrowAmounts &&
                    markerIndices[i] !== -1 && (
                      <span className="text-xs text-blue-300 mt-1">
                        {hasPriceData
                          ? formatUsdAmount(
                              Number(
                                formatUnits(
                                  simulationSeries.borrowAmounts[
                                    markerIndices[i]
                                  ],
                                  marketAsset.loanAsset.decimals || 18
                                )
                              ) * effectivePrice,
                              1
                            )
                          : `${Number(
                              formatUnits(
                                simulationSeries.borrowAmounts[
                                  markerIndices[i]
                                ],
                                marketAsset.loanAsset.decimals || 18
                              )
                            ).toFixed(2)} ${
                              marketAsset.loanAsset.symbol || ""
                            }`}
                      </span>
                    )}
                </div>
              ))}
            </div>
            {/* Y-Axis Labels */}
            <div className="absolute left-0 top-0 h-[calc(100%-24px)] flex flex-col justify-between text-xs text-gray-400 -ml-6">
              <span>{maxYScale}%</span>
              <span>{maxYScale / 2}%</span>
              <span>0%</span>
            </div>
            <div className="text-center text-xs text-gray-400 mt-2">
              % of Available Liquidity Borrowed
            </div>
          </div>
          {/* Additional Metrics */}
          <div className="mt-20 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>Max Available Liquidity:</span>
              <span className="text-green-400">
                {marketAsset && simulationSeries.initialLiquidity
                  ? hasPriceData
                    ? formatUsdAmount(
                        Number(
                          formatUnits(
                            simulationSeries.initialLiquidity,
                            marketAsset.loanAsset.decimals || 18
                          )
                        ) * effectivePrice,
                        2
                      )
                    : `${Number(
                        formatUnits(
                          simulationSeries.initialLiquidity,
                          marketAsset.loanAsset.decimals || 18
                        )
                      ).toFixed(2)} ${marketAsset.loanAsset.symbol || ""}`
                  : "Loading..."}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Max APY:</span>
              <span className="text-green-400">
                {Math.max(...simulationSeries.apySeries).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between mb-1 text-xs">
              <span className="text-gray-400">Current Utilization</span>
              <span className="text-white">
                {simulationSeries.utilizationSeries[0].toFixed(2)}%
              </span>
            </div>
          </div>
          <button
            onClick={onUseMaxAvailable}
            className="mt-2 w-full bg-blue-500/30 text-white text-xs p-2 rounded hover:bg-blue-600/30"
          >
            Use Max Available Amount
          </button>
        </>
      )}
    </div>
  );
};

export default MarketMetricsChart;

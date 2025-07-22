import React, { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { ChartConfig, ChartContainer } from "./ui/chart";
import { TrendingUp, Activity } from "lucide-react";
import { fetchAssetPriceDL } from "../fetchers/fetchDLPrice";
import { formatUsdAmount } from "../utils/utils";

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
  chainId: number;
}

const chartConfig = {
  apy: {
    label: "Borrow APY",
    color: "#5792FF",
    icon: Activity,
  },
} satisfies ChartConfig;

const MarketMetricsChart: React.FC<MarketMetricsChartProps> = ({
  simulationSeries,
  marketAsset,
  onUseMaxAvailable,
  loading,
  chainId,
}) => {
  const [assetPrice, setAssetPrice] = useState<number | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState<boolean>(false);
  const [manualPrice, setManualPrice] = useState<string>("");
  const [isManualPriceSet, setIsManualPriceSet] = useState<boolean>(false);
  const [priceAttempts, setPriceAttempts] = useState<string[]>([]);

  // Fetch price from DefiLlama if marketAsset exists but priceUsd is null
  useEffect(() => {
    async function fetchPrice() {
      if (marketAsset?.loanAsset && !marketAsset.loanAsset.priceUsd) {
        try {
          setIsLoadingPrice(true);

          const priceData = await fetchAssetPriceDL(
            marketAsset.loanAsset.address,
            chainId
          );

          if (priceData) {
            setAssetPrice(priceData.price);
          } else {
            // Track which attempts were made (this would be enhanced by modifying fetchAssetPriceDL to return attempt details)
            const chainName = chainId === 1 ? 'ethereum' : `chain-${chainId}`;
            setPriceAttempts(prev => [...prev, chainName]);
          }
        } catch (error) {
          console.error("Failed to fetch price from DefiLlama:", error);
          const chainName = chainId === 1 ? 'ethereum' : `chain-${chainId}`;
          setPriceAttempts(prev => [...prev, `${chainName} (error)`]);
        } finally {
          setIsLoadingPrice(false);
        }
      }
    }

    fetchPrice();
  }, [marketAsset, chainId]);

  if (loading || isLoadingPrice) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </CardContent>
      </Card>
    );
  }

  if (!simulationSeries) {
    return null;
  }

  // Get effective price (use manual price if set, then DefiLlama price as fallback)
  const manualPriceValue = isManualPriceSet && parseFloat(manualPrice) > 0 ? parseFloat(manualPrice) : null;
  const effectivePrice = marketAsset?.loanAsset.priceUsd || manualPriceValue || assetPrice || 0;
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

  // Calculate total liquidity in USD for X-axis labels
  const totalLiquidityUsd = marketAsset && simulationSeries.initialLiquidity
    ? Number(formatUnits(simulationSeries.initialLiquidity, marketAsset.loanAsset.decimals || 18)) * effectivePrice
    : 0;

  // Create comprehensive chart data for every 1% (for hover) and mark 10% intervals (for display)
  const createStandardizedData = () => {
    const standardData = [];
    for (let i = 0; i <= 100; i += 1) { // Every 1% for smooth hover
      // Find closest data point or interpolate
      const closestIndex = simulationSeries.percentages.findIndex(p => Math.abs(p - i) < 0.5);
      
      if (closestIndex !== -1) {
        // Use existing data point
        standardData.push({
          percentage: i,
          percentageLabel: `${i}%`,
          apy: simulationSeries.apySeries[closestIndex],
          utilization: simulationSeries.utilizationSeries[closestIndex],
          borrowAmount: simulationSeries.borrowAmounts[closestIndex],
          borrowAmountFormatted: getFormattedBorrowAmount(simulationSeries.borrowAmounts[closestIndex]),
          usdValue: formatUsdAmount((i / 100) * totalLiquidityUsd, 2),
          showDot: i % 10 === 0, // Only show dots at 10% intervals
          showTick: i % 10 === 0 // Only show X-axis ticks at 10% intervals
        });
      } else {
        // Interpolate between closest points
        const lowerIndex = simulationSeries.percentages.findIndex(p => p > i) - 1;
        const upperIndex = lowerIndex + 1;
        
        if (lowerIndex >= 0 && upperIndex < simulationSeries.percentages.length) {
          const lowerPerc = simulationSeries.percentages[lowerIndex];
          const upperPerc = simulationSeries.percentages[upperIndex];
          const ratio = (i - lowerPerc) / (upperPerc - lowerPerc);
          
          const interpolatedApy = simulationSeries.apySeries[lowerIndex] + 
            (simulationSeries.apySeries[upperIndex] - simulationSeries.apySeries[lowerIndex]) * ratio;
          const interpolatedUtilization = simulationSeries.utilizationSeries[lowerIndex] + 
            (simulationSeries.utilizationSeries[upperIndex] - simulationSeries.utilizationSeries[lowerIndex]) * ratio;
          
          // Calculate interpolated borrow amount
          const lowerAmount = Number(formatUnits(simulationSeries.borrowAmounts[lowerIndex], marketAsset?.loanAsset.decimals || 18));
          const upperAmount = Number(formatUnits(simulationSeries.borrowAmounts[upperIndex], marketAsset?.loanAsset.decimals || 18));
          const interpolatedAmount = lowerAmount + (upperAmount - lowerAmount) * ratio;
          const interpolatedAmountBigInt = BigInt(Math.round(interpolatedAmount * Math.pow(10, marketAsset?.loanAsset.decimals || 18)));
          
          standardData.push({
            percentage: i,
            percentageLabel: `${i}%`,
            apy: interpolatedApy,
            utilization: interpolatedUtilization,
            borrowAmount: interpolatedAmountBigInt,
            borrowAmountFormatted: getFormattedBorrowAmount(interpolatedAmountBigInt),
            usdValue: formatUsdAmount((i / 100) * totalLiquidityUsd, 2),
            showDot: i % 10 === 0,
            showTick: i % 10 === 0
          });
        } else {
          // Use edge case values
          const edgeIndex = lowerIndex < 0 ? 0 : simulationSeries.percentages.length - 1;
          standardData.push({
            percentage: i,
            percentageLabel: `${i}%`,
            apy: simulationSeries.apySeries[edgeIndex],
            utilization: simulationSeries.utilizationSeries[edgeIndex],
            borrowAmount: simulationSeries.borrowAmounts[edgeIndex],
            borrowAmountFormatted: getFormattedBorrowAmount(simulationSeries.borrowAmounts[edgeIndex]),
            usdValue: formatUsdAmount((i / 100) * totalLiquidityUsd, 2),
            showDot: i % 10 === 0,
            showTick: i % 10 === 0
          });
        }
      }
    }
    return standardData;
  };

  const chartData = createStandardizedData();

  const maxApy = Math.max(...simulationSeries.apySeries);
  const maxAvailableLiquidity = marketAsset && simulationSeries.initialLiquidity
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
    : "Loading...";

  // Custom X-axis tick component with percentage and USD values (only for 10% intervals)
  const CustomXAxisTick = ({ x, y, payload }: any) => {
    const data = chartData.find(d => d.percentage === payload.value && d.showTick);
    if (!data) return null;

    return (
      <g transform={`translate(${x},${y})`}>
        <text 
          x={0} 
          y={0} 
          dy={14} 
          textAnchor="middle" 
          fill="#666" 
          fontSize="11"
          className="text-xs"
        >
          {data.percentageLabel}
        </text>
        <text 
          x={0} 
          y={0} 
          dy={30} 
          textAnchor="middle" 
          fill="#888" 
          fontSize="9"
          className="text-xs"
        >
          {data.usdValue}
        </text>
      </g>
    );
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
          <p className="font-medium text-xs mb-1">{data.percentageLabel} of Available Liquidity</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Borrow APY:</span>
              <span className="font-medium" style={{ color: "#5792FF" }}>
                {data.apy.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-medium">{data.borrowAmountFormatted}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">USD Value:</span>
              <span className="font-medium">{data.usdValue}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Utilization:</span>
              <span className="font-medium">{data.utilization.toFixed(2)}%</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const handleManualPriceSubmit = () => {
    const price = parseFloat(manualPrice);
    if (price > 0) {
      setIsManualPriceSet(true);
    }
  };

  const handleManualPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualPrice(e.target.value);
  };

  const handleManualPriceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleManualPriceSubmit();
    }
  };

  const clearManualPrice = () => {
    setManualPrice("");
    setIsManualPriceSet(false);
  };

  // Show price input UI when no price data is available
  if (!hasPriceData && !isManualPriceSet) {
    return (
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="p-3 bg-yellow-100 text-yellow-800 text-sm rounded-lg">
            ⚠️ Price data unavailable for <strong>{marketAsset?.loanAsset.symbol || 'Unknown Token'}</strong> 
            {marketAsset?.loanAsset.address && (
              <span className="text-xs block mt-1 font-mono">
                ({marketAsset.loanAsset.address.slice(0, 8)}...{marketAsset.loanAsset.address.slice(-6)})
              </span>
            )}
            <br />Some USD values may not display correctly.
            {priceAttempts.length > 0 && (
              <div className="text-xs mt-2 text-yellow-700">
                Tried: {priceAttempts.join(', ')} and cross-chain fallbacks
              </div>
            )}
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-700 mb-2">
              Enter the current USD price for <strong>{marketAsset?.loanAsset.symbol || 'this asset'}</strong> to display the chart:
            </div>
            <div className="text-xs text-gray-600 mb-2">
              Example: If {marketAsset?.loanAsset.symbol || 'the token'} is currently trading at $1.00, enter "1.00"
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={manualPrice}
                onChange={handleManualPriceChange}
                onKeyDown={handleManualPriceKeyDown}
                placeholder={`${marketAsset?.loanAsset.symbol || 'Asset'} price in USD`}
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                step="any"
                min="0"
              />
              <button
                onClick={handleManualPriceSubmit}
                disabled={!manualPrice || parseFloat(manualPrice) <= 0}
                className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Use Price
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (simulationSeries.utilizationSeries.every((u) => u === 0)) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="p-3 bg-yellow-100 text-yellow-900 text-sm rounded-lg">
            ⚠️ This market does not exist on the current chain. Try switching networks.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Market Borrow Simulation
        </CardTitle>
        <CardDescription>
          Borrow APY in function of the future borrow liquidity
          {isManualPriceSet && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                Using manual price: ${parseFloat(manualPrice).toFixed(4)}
              </span>
              <button 
                onClick={clearManualPrice}
                className="text-blue-600 hover:text-blue-800 underline"
                title="Clear manual price"
              >
                Clear
              </button>
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[350px] w-full">
          <AreaChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 50,
            }}
          >
            <defs>
              <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5792FF" stopOpacity={0.6} />
                <stop offset="50%" stopColor="#5792FF" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#5792FF" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="percentage"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={<CustomXAxisTick />}
              domain={[0, 100]}
              ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
              className="text-xs"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `${value}%`}
              className="text-xs"
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "3 3" }}
            />
            <Area
              dataKey="apy"
              type="monotone"
              fill="url(#blueGradient)"
              stroke="#5792FF"
              strokeWidth={2}
              dot={(props: any) => {
                const data = chartData.find(d => d.percentage === props.payload?.percentage);
                if (!data?.showDot) {
                  return <g />; // Return empty g element instead of null
                }
                return (
                  <circle 
                    cx={props.cx} 
                    cy={props.cy} 
                    r={4} 
                    fill="#5792FF" 
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 6, strokeWidth: 0, fill: "#5792FF" }}
            />
          </AreaChart>
        </ChartContainer>
        
        {/* Additional Metrics */}
        <div className="mt-3 flex justify-center">
          <div className="grid grid-cols-3 gap-6 text-xs">
            <div className="text-center">
              <div className="text-muted-foreground mb-1">Max Available Liquidity</div>
              <div className="font-semibold text-green-600">{maxAvailableLiquidity}</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground mb-1">Max APY</div>
              <div className="font-semibold text-green-600">{maxApy.toFixed(2)}%</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground mb-1">Current Utilization</div>
              <div className="font-semibold">{simulationSeries.utilizationSeries[0].toFixed(2)}%</div>
            </div>
          </div>
        </div>

        <button
          onClick={onUseMaxAvailable}
          className="mt-4 w-full bg-[#5792FF] text-white text-sm py-2.5 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
        >
          <TrendingUp className="h-4 w-4" />
          Use Max Available Amount
        </button>
      </CardContent>
    </Card>
  );
};

export default MarketMetricsChart;
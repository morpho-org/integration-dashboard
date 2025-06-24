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
}

const chartConfig = {
  apy: {
    label: "Borrow APY",
    color: "hsl(var(--chart-1))",
    icon: Activity,
  },
} satisfies ChartConfig;

const MarketMetricsChart: React.FC<MarketMetricsChartProps> = ({
  simulationSeries,
  marketAsset,
  onUseMaxAvailable,
  loading,
}) => {
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

  // Transform data for Recharts
  const chartData = simulationSeries.percentages.map((percentage, index) => ({
    percentage: percentage.toFixed(1),
    apy: simulationSeries.apySeries[index],
    utilization: simulationSeries.utilizationSeries[index],
    borrowAmount: simulationSeries.borrowAmounts[index],
    borrowAmountFormatted: getFormattedBorrowAmount(simulationSeries.borrowAmounts[index]),
  }));

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

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}% of Available Liquidity</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Borrow APY:</span>
              <span className="font-medium text-[hsl(var(--chart-1))]">
                {data.apy.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-medium">{data.borrowAmountFormatted}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Utilization:</span>
              <span className="font-medium">{data.utilization.toFixed(2)}%</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (!hasPriceData) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="p-3 bg-yellow-100 text-yellow-800 text-sm rounded-lg">
            ⚠️ Price data unavailable for this market on the current chain. Some USD values may not display correctly.
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
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 20,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="percentage"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `${value}%`}
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
              fill="hsl(var(--chart-1))"
              fillOpacity={0.3}
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              dot={{ fill: "hsl(var(--chart-1))", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </AreaChart>
        </ChartContainer>
        
        {/* Additional Metrics */}
        <div className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Max Available Liquidity:</span>
            <span className="font-semibold text-green-600">{maxAvailableLiquidity}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Max APY:</span>
            <span className="font-semibold text-green-600">{maxApy.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Current Utilization:</span>
            <span className="font-semibold">{simulationSeries.utilizationSeries[0].toFixed(2)}%</span>
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
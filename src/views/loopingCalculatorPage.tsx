import React, { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  LoopingCalculatorInputs,
  DEFAULT_INPUTS,
} from "../types/loopingCalculator";
import {
  calculateLoopingStrategy,
  generateROEChartData,
  validateInputs,
} from "../core/loopingCalculator";

// Custom Tooltip component with 0.3s delay
const Tooltip = ({ content }: { content: string }) => {
  return (
    <span className="relative inline-block ml-1 group">
      <span className="text-gray-400 cursor-help hover:text-gray-600 transition-colors">
        ?
      </span>
      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1.5 bg-gray-800 text-white text-xs rounded-md whitespace-normal w-64 text-left z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-300 pointer-events-none shadow-lg">
        {content}
        <span className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-gray-800" />
      </span>
    </span>
  );
};

// SimpleCard component - Collapsible card matching existing pattern
const SimpleCard = ({
  title,
  children,
  initialCollapsed = false,
  tooltip,
}: {
  title: string;
  children: React.ReactNode;
  initialCollapsed?: boolean;
  tooltip?: string;
}) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  return (
    <div className="text-xs bg-white text-gray-900 rounded-lg shadow-md p-4 mb-4">
      <div
        className="flex items-center cursor-pointer mb-2"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <span className="text-gray-600 mr-2">
          {isCollapsed ? "\u25bc" : "\u25b2"}
        </span>
        <h3 className="text-l font-semibold">
          {title}
          {tooltip && (
            <span onClick={(e) => e.stopPropagation()}>
              <Tooltip content={tooltip} />
            </span>
          )}
        </h3>
      </div>
      <div
        className={`transition-all duration-300 ${
          isCollapsed ? "hidden" : "block"
        }`}
      >
        {children}
      </div>
    </div>
  );
};

// Input field component with label
const InputField = ({
  label,
  value,
  onChange,
  suffix,
  disabled = false,
  min,
  max,
  step,
  tooltip,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  tooltip?: string;
}) => {
  return (
    <div className={disabled ? "opacity-50" : ""}>
      <label className="block text-m font-medium mb-1 text-gray-700">
        {label}
        {tooltip && <Tooltip content={tooltip} />}
      </label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          className={`w-full px-2 py-1.5 rounded-md border border-gray-300 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
            disabled ? "bg-gray-100 cursor-not-allowed" : ""
          } ${suffix ? "pr-12" : ""}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
};

// Percentage input (displays and accepts percentages, stores as decimal)
const PercentageInput = ({
  label,
  value,
  onChange,
  disabled = false,
  tooltip,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  tooltip?: string;
}) => {
  return (
    <InputField
      label={label}
      value={Math.round(value * 10000) / 100} // Convert decimal to percentage
      onChange={(v) => onChange(v / 100)} // Convert percentage to decimal
      suffix="%"
      disabled={disabled}
      min={0}
      max={100}
      step={0.1}
      tooltip={tooltip}
    />
  );
};

// Format currency
const formatCurrency = (value: number): string => {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  } else if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
};

// Format percentage
const formatPercent = (value: number, decimals: number = 2): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};

// Metric display component
const Metric = ({
  label,
  value,
  subValue,
  positive,
  negative,
  large,
  tooltip,
}: {
  label: string;
  value: string;
  subValue?: string;
  positive?: boolean;
  negative?: boolean;
  large?: boolean;
  tooltip?: string;
}) => {
  const colorClass = positive
    ? "text-green-600"
    : negative
      ? "text-red-600"
      : "text-blue-600";
  const sizeClass = large ? "text-2xl" : "text-l";

  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">
        {label}
        {tooltip && <Tooltip content={tooltip} />}
      </p>
      <p className={`${sizeClass} font-bold ${colorClass}`}>{value}</p>
      {subValue && <p className="text-xs text-gray-400 mt-0.5">{subValue}</p>}
    </div>
  );
};

const LoopingCalculatorPage: React.FC = () => {
  const [inputs, setInputs] = useState<LoopingCalculatorInputs>(DEFAULT_INPUTS);
  const [showSlippage, setShowSlippage] = useState(false);

  // Update a single input field
  const updateInput = (
    field: keyof LoopingCalculatorInputs,
    value: number
  ) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  // Validation error
  const validationError = useMemo(() => validateInputs(inputs), [inputs]);

  // Calculate results (memoized for performance)
  const results = useMemo(() => {
    if (validationError) return null;
    return calculateLoopingStrategy(inputs);
  }, [inputs, validationError]);

  // Generate chart data
  const chartData = useMemo(() => {
    if (validationError) return [];
    return generateROEChartData(inputs, 30);
  }, [inputs, validationError]);

  // Find current leverage point in chart
  const currentLeverageData = useMemo(() => {
    if (!results) return null;
    return {
      leverage: inputs.turnsOfLeverage,
      roe: results.loopROE * 100,
      ltv: results.targetLTV * 100,
    };
  }, [results, inputs.turnsOfLeverage]);

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left side - Input form */}
          <div className="w-full lg:w-1/3">
            <SimpleCard title="Input Parameters">
              <div className="space-y-4">
                {/* Slippage Section - Greyed out by default */}
                <div className="border-b border-gray-200 pb-3">
                  <div
                    className="flex items-center justify-between cursor-pointer mb-2"
                    onClick={() => setShowSlippage(!showSlippage)}
                  >
                    <span className="text-m font-medium text-gray-500">
                      Slippage (Optional)
                    </span>
                    <span className="text-xs text-gray-400">
                      {showSlippage ? "Hide" : "Show"}
                    </span>
                  </div>
                  {showSlippage && (
                    <div className="space-y-3 mt-3">
                      <PercentageInput
                        label="Entry Cost (Annualized)"
                        value={inputs.insuranceUpfrontCost}
                        onChange={(v) => updateInput("insuranceUpfrontCost", v)}
                        tooltip="Annual cost of entry slippage, paid upfront"
                      />
                      <InputField
                        label="Trade Duration"
                        value={inputs.coverageDurationDays}
                        onChange={(v) => updateInput("coverageDurationDays", v)}
                        suffix="days"
                        min={1}
                        max={365}
                        tooltip="Duration of trade period"
                      />
                      <PercentageInput
                        label="Exit Cost"
                        value={inputs.additionalInsuranceCost}
                        onChange={(v) =>
                          updateInput("additionalInsuranceCost", v)
                        }
                        tooltip="Exit slippage or swap haircut"
                      />
                    </div>
                  )}
                </div>

                {/* Lending Market Section */}
                <div className="border-b border-gray-200 pb-3">
                  <span className="text-m font-medium text-gray-700 block mb-3">
                    Lending Market
                  </span>
                  <div className="space-y-3">
                    <PercentageInput
                      label="Borrow Rate (APY)"
                      value={inputs.borrowRate}
                      onChange={(v) => updateInput("borrowRate", v)}
                      tooltip="Annual interest rate for borrowing"
                    />
                    <PercentageInput
                      label="LTV Cap"
                      value={inputs.ltvCap}
                      onChange={(v) => updateInput("ltvCap", v)}
                      tooltip="Maximum LTV allowed by the market"
                    />
                    <PercentageInput
                      label="Liquidation LTV (LLTV)"
                      value={inputs.liquidationLTV}
                      onChange={(v) => updateInput("liquidationLTV", v)}
                      tooltip="LTV threshold that triggers liquidation"
                    />
                  </div>
                </div>

                {/* Looping Strategy Section */}
                <div className="border-b border-gray-200 pb-3">
                  <span className="text-m font-medium text-gray-700 block mb-3">
                    Looping Strategy
                  </span>
                  <div className="space-y-3">
                    <PercentageInput
                      label="Asset Yield (APY)"
                      value={inputs.assetYield}
                      onChange={(v) => updateInput("assetYield", v)}
                      tooltip="Expected yield on the looped asset"
                    />
                    <InputField
                      label="Turns of Leverage"
                      value={inputs.turnsOfLeverage}
                      onChange={(v) => updateInput("turnsOfLeverage", v)}
                      suffix="x"
                      min={1}
                      max={20}
                      step={0.5}
                      tooltip="Number of leverage iterations (e.g., 8x means 8 times exposure)"
                    />
                    <InputField
                      label="Capital Deposited"
                      value={inputs.capitalDeposited}
                      onChange={(v) => updateInput("capitalDeposited", v)}
                      suffix="USD"
                      min={1}
                      tooltip="Initial capital to deposit"
                    />
                  </div>
                </div>

                {/* Unwind Scenario Section */}
                <div>
                  <span className="text-m font-medium text-gray-700 block mb-3">
                    Unwind Scenario
                  </span>
                  <PercentageInput
                    label="NAV Drop"
                    value={inputs.navDrop}
                    onChange={(v) => updateInput("navDrop", v)}
                    tooltip="Simulated price drop for stress testing"
                  />
                </div>

                {/* Validation Error */}
                {validationError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-xs">
                    {validationError}
                  </div>
                )}
              </div>
            </SimpleCard>
          </div>

          {/* Right side - Results */}
          <div className="w-full lg:w-2/3 flex flex-col gap-4">
            {results && (
              <>
                {/* Main ROE Card */}
                <SimpleCard title="Loop Returns">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Metric
                      label="Loop ROE (Annualized)"
                      value={formatPercent(results.loopROE)}
                      subValue={`${formatCurrency(results.netReturn.netEarnings)} net earnings`}
                      positive={results.loopROE > 0}
                      negative={results.loopROE < 0}
                      large
                      tooltip="Return on Equity: (Net Earnings / Capital) x Terms per Year. Net Earnings = Gross Yield - Debt Cost - Slippage."
                    />
                    <Metric
                      label="Notional Exposure"
                      value={formatCurrency(results.notionalExposure)}
                      subValue={`${inputs.turnsOfLeverage}x leverage`}
                      tooltip="Total value of assets purchased (Initial RWA + Additional RWA from borrowed funds). Equals Capital x Turns of Leverage."
                    />
                    <Metric
                      label="Target LTV"
                      value={formatPercent(results.targetLTV)}
                      subValue={`Cap: ${formatPercent(inputs.ltvCap)}`}
                      tooltip="Loan-to-Value ratio: Total Debt / Total Exposure. Measures how leveraged the position is."
                    />
                    <Metric
                      label="Accrued Interest"
                      value={formatCurrency(results.accruedInterest)}
                      subValue="per term"
                      negative
                      tooltip="Interest cost per term: Total Debt x (Borrow Rate / Terms per Year)."
                    />
                  </div>

                  {/* Earnings Breakdown */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <p className="text-gray-500">
                          Gross Earnings
                          <Tooltip content="Total Exposure x (Asset Yield / Terms per Year). Yield earned on all looped assets." />
                        </p>
                        <p className="text-green-600 font-semibold">
                          +{formatCurrency(results.netReturn.earnings)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">
                          Debt Cost
                          <Tooltip content="Total Debt x (Borrow Rate / Terms per Year). Interest paid on borrowed funds." />
                        </p>
                        <p className="text-red-600 font-semibold">
                          -{formatCurrency(results.netReturn.debtCost)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">
                          Slippage Cost
                          <Tooltip content="Present-value adjusted slippage cost on both initial capital and borrowed funds." />
                        </p>
                        <p className="text-red-600 font-semibold">
                          -{formatCurrency(results.netReturn.totalInsuranceCost)}
                        </p>
                      </div>
                    </div>
                  </div>
                </SimpleCard>

                {/* ROE vs Leverage Chart */}
                <SimpleCard title="ROE vs Leverage" tooltip="Shows how Return on Equity changes as you increase leverage. Higher leverage amplifies both gains and losses.">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartData}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="roeGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#5792FF"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="#5792FF"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="leverage"
                          tickFormatter={(v) => `${v}x`}
                          tick={{ fontSize: 10 }}
                          stroke="#9ca3af"
                        />
                        <YAxis
                          tickFormatter={(v) => `${v}%`}
                          tick={{ fontSize: 10 }}
                          stroke="#9ca3af"
                        />
                        <RechartsTooltip
                          formatter={(value: number) => [
                            `${value.toFixed(2)}%`,
                            "ROE",
                          ]}
                          labelFormatter={(label) => `Leverage: ${label}x`}
                          contentStyle={{
                            fontSize: 12,
                            backgroundColor: "white",
                            border: "1px solid #e5e7eb",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="roe"
                          stroke="#5792FF"
                          strokeWidth={2}
                          fill="url(#roeGradient)"
                        />
                        {currentLeverageData && (
                          <ReferenceLine
                            x={currentLeverageData.leverage}
                            stroke="#10b981"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            label={{
                              value: `Current: ${currentLeverageData.leverage}x`,
                              position: "top",
                              fontSize: 10,
                              fill: "#10b981",
                            }}
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    Green line shows your current leverage ({inputs.turnsOfLeverage}x)
                  </p>
                </SimpleCard>

                {/* Risk Metrics */}
                <SimpleCard title="Risk Metrics (NAV Drop Thresholds)">
                  <div className="grid grid-cols-2 gap-6">
                    {/* At Target Leverage */}
                    <div>
                      <h4 className="text-m font-medium text-gray-700 mb-3">
                        At Target Leverage ({inputs.turnsOfLeverage}x)
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">
                            NAV drop to trigger LLTV
                            <Tooltip content="LLTV = Liquidation LTV. Formula: 1 - (Debt + Interest + Slippage) / (LLTV x Exposure x (1 - Exit Fee)). How much asset price can fall before liquidation." />
                          </span>
                          <span
                            className={`text-m font-semibold ${
                              results.riskMetrics.navDropToLLTV_Target < 0.1
                                ? "text-red-600"
                                : results.riskMetrics.navDropToLLTV_Target < 0.2
                                  ? "text-yellow-600"
                                  : "text-green-600"
                            }`}
                          >
                            {formatPercent(
                              results.riskMetrics.navDropToLLTV_Target
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">
                            NAV drop to bad debt
                            <Tooltip content="Formula: 1 - (Debt + Interest + Slippage) / (Exposure x (1 - Exit Fee)). How much asset price can fall before collateral is worth less than debt." />
                          </span>
                          <span
                            className={`text-m font-semibold ${
                              results.riskMetrics.navDropToBadDebt_Target < 0.1
                                ? "text-red-600"
                                : results.riskMetrics.navDropToBadDebt_Target <
                                    0.2
                                  ? "text-yellow-600"
                                  : "text-green-600"
                            }`}
                          >
                            {formatPercent(
                              results.riskMetrics.navDropToBadDebt_Target
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* At LTV Cap */}
                    <div>
                      <h4 className="text-m font-medium text-gray-700 mb-3">
                        At LTV Cap ({formatPercent(inputs.ltvCap)})
                        <Tooltip content="Maximum leverage scenario: what happens if you borrow up to the market's LTV cap limit." />
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">
                            NAV drop to trigger LLTV
                            <Tooltip content="Same formula as target leverage, but calculated at maximum possible leverage (LTV Cap)." />
                          </span>
                          <span
                            className={`text-m font-semibold ${
                              results.riskMetrics.navDropToLLTV_Cap < 0.05
                                ? "text-red-600"
                                : results.riskMetrics.navDropToLLTV_Cap < 0.1
                                  ? "text-yellow-600"
                                  : "text-green-600"
                            }`}
                          >
                            {formatPercent(results.riskMetrics.navDropToLLTV_Cap)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">
                            NAV drop to bad debt
                            <Tooltip content="Same formula as target leverage, but calculated at maximum possible leverage (LTV Cap)." />
                          </span>
                          <span
                            className={`text-m font-semibold ${
                              results.riskMetrics.navDropToBadDebt_Cap < 0.05
                                ? "text-red-600"
                                : results.riskMetrics.navDropToBadDebt_Cap < 0.1
                                  ? "text-yellow-600"
                                  : "text-green-600"
                            }`}
                          >
                            {formatPercent(
                              results.riskMetrics.navDropToBadDebt_Cap
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </SimpleCard>

                {/* Exposure Breakdown */}
                <SimpleCard title="Exposure Breakdown" initialCollapsed={true}>
                  <div className="grid grid-cols-2 gap-6">
                    {/* Target Leverage */}
                    <div>
                      <h4 className="text-m font-medium text-blue-600 mb-3">
                        Target Leverage ({inputs.turnsOfLeverage}x)
                      </h4>
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-gray-100">
                          <tr>
                            <td className="py-1.5 text-gray-500">
                              Initial Principal
                              <Tooltip content="Your deposited capital before any leverage." />
                            </td>
                            <td className="py-1.5 text-right font-medium">
                              {formatCurrency(
                                results.targetLeverage.initialPrincipal
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-gray-500">
                              Slippage Cost
                              <Tooltip content="Capital x (Entry Cost / Terms per Year), adjusted for present value. Deducted from principal." />
                            </td>
                            <td className="py-1.5 text-right font-medium text-red-600">
                              -
                              {formatCurrency(
                                results.targetLeverage.insuranceCost
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-gray-500">
                              RWA Purchase
                              <Tooltip content="Real World Asset purchase from initial capital. Formula: Principal - Slippage Cost." />
                            </td>
                            <td className="py-1.5 text-right font-medium">
                              {formatCurrency(
                                results.targetLeverage.rwaPurchase
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-gray-500">
                              Total Debt
                              <Tooltip content="Amount borrowed. Formula: RWA Purchase x (Leverage - 1). At 8x leverage, you borrow 7x your initial RWA." />
                            </td>
                            <td className="py-1.5 text-right font-medium text-red-600">
                              {formatCurrency(results.targetLeverage.totalDebt)}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-gray-500">
                              Additional RWA
                              <Tooltip content="RWA purchased with borrowed funds. Formula: Total Debt - Slippage on Debt." />
                            </td>
                            <td className="py-1.5 text-right font-medium">
                              {formatCurrency(
                                results.targetLeverage.additionalRwaPurchase
                              )}
                            </td>
                          </tr>
                          <tr className="bg-blue-50">
                            <td className="py-1.5 font-medium">
                              Total Exposure
                              <Tooltip content="Sum of all RWA (Initial + Additional). This is your total asset position that earns yield." />
                            </td>
                            <td className="py-1.5 text-right font-bold text-blue-600">
                              {formatCurrency(
                                results.targetLeverage.totalExposure
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-gray-500">
                              LTV
                              <Tooltip content="Loan-to-Value: Total Debt / Total Exposure. Higher = more leveraged = more risk." />
                            </td>
                            <td className="py-1.5 text-right font-medium">
                              {formatPercent(results.targetLeverage.ltv)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Max Leverage (LTV Cap) */}
                    <div>
                      <h4 className="text-m font-medium text-gray-600 mb-3">
                        Max Leverage (at LTV Cap)
                        <Tooltip content="Theoretical maximum leverage using 1/(1-LTV Cap). At 90% cap = 10x max leverage." />
                      </h4>
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-gray-100">
                          <tr>
                            <td className="py-1.5 text-gray-500">
                              Initial Principal
                            </td>
                            <td className="py-1.5 text-right font-medium">
                              {formatCurrency(
                                results.maxLeverage.initialPrincipal
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-gray-500">
                              Slippage Cost
                            </td>
                            <td className="py-1.5 text-right font-medium text-red-600">
                              -
                              {formatCurrency(results.maxLeverage.insuranceCost)}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-gray-500">
                              RWA Purchase
                            </td>
                            <td className="py-1.5 text-right font-medium">
                              {formatCurrency(results.maxLeverage.rwaPurchase)}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-gray-500">
                              Total Debt
                              <Tooltip content="At LTV Cap: RWA x ((1/(1-LTV Cap)) - 1). At 90% cap, debt = RWA x 9." />
                            </td>
                            <td className="py-1.5 text-right font-medium text-red-600">
                              {formatCurrency(results.maxLeverage.totalDebt)}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-gray-500">
                              Additional RWA
                            </td>
                            <td className="py-1.5 text-right font-medium">
                              {formatCurrency(
                                results.maxLeverage.additionalRwaPurchase
                              )}
                            </td>
                          </tr>
                          <tr className="bg-gray-50">
                            <td className="py-1.5 font-medium">
                              Total Exposure
                            </td>
                            <td className="py-1.5 text-right font-bold text-gray-600">
                              {formatCurrency(
                                results.maxLeverage.totalExposure
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-gray-500">LTV</td>
                            <td className="py-1.5 text-right font-medium">
                              {formatPercent(results.maxLeverage.ltv)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </SimpleCard>

                {/* Unwind Scenario */}
                <SimpleCard title={`Unwind Scenario (${formatPercent(inputs.navDrop)} NAV Drop)`}>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <Metric
                      label="Current LTV"
                      value={formatPercent(results.unwind.currentLTV)}
                      subValue={
                        results.unwind.currentLTV > inputs.liquidationLTV
                          ? "Above LLTV!"
                          : `LLTV: ${formatPercent(inputs.liquidationLTV)}`
                      }
                      negative={results.unwind.currentLTV > inputs.liquidationLTV}
                      tooltip="LTV after NAV drop: Debt / (Exposure x (1 - NAV Drop)). If this exceeds LLTV, position gets liquidated."
                    />
                    <Metric
                      label="Exposure After Drop"
                      value={formatCurrency(
                        results.unwind.currentNotionalExposure
                      )}
                      subValue={`was ${formatCurrency(results.notionalExposure)}`}
                      tooltip="Total Exposure x (1 - NAV Drop). The reduced value of your assets after the price drop."
                    />
                    <Metric
                      label="P&L"
                      value={formatCurrency(results.unwind.pnl)}
                      subValue={formatPercent(
                        results.unwind.annualizedReturn,
                        1
                      ) + " annualized"}
                      positive={results.unwind.pnl > 0}
                      negative={results.unwind.pnl < 0}
                      tooltip="Profit/Loss: Remaining Capital - Initial Capital. What you'd have left (or lost) after unwinding."
                    />
                    <Metric
                      label="Bad Debt?"
                      value={results.unwind.noBadDebt ? "No" : "Yes"}
                      subValue={
                        results.unwind.noBadDebt
                          ? "Collateral covers debt"
                          : "Collateral insufficient"
                      }
                      positive={results.unwind.noBadDebt}
                      negative={!results.unwind.noBadDebt}
                      tooltip="Bad debt occurs when Available to Repay < Total Owed. The protocol takes a loss."
                    />
                  </div>

                  {/* Detailed breakdown */}
                  <div className="border-t border-gray-100 pt-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                      <div>
                        <p className="text-gray-500">
                          Cost to Exit
                          <Tooltip content="Swap haircut / exit fee: Exposure After Drop x Exit Cost (exit fee %)." />
                        </p>
                        <p className="font-medium text-red-600">
                          -{formatCurrency(results.unwind.costToExit)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">
                          Available to Repay
                          <Tooltip content="Exposure After Drop - Cost to Exit. What you can use to pay back debt." />
                        </p>
                        <p className="font-medium">
                          {formatCurrency(results.unwind.availableToRepay)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">
                          Total Owed
                          <Tooltip content="Principal Owed + Interest Owed. Your total debt obligation to repay." />
                        </p>
                        <p className="font-medium text-red-600">
                          {formatCurrency(results.unwind.totalOwed)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">
                          Remaining Capital
                          <Tooltip content="Available to Repay - Total Owed. What you keep after closing the position." />
                        </p>
                        <p
                          className={`font-medium ${
                            results.unwind.remainingCapital >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {formatCurrency(results.unwind.remainingCapital)}
                        </p>
                      </div>
                    </div>
                  </div>
                </SimpleCard>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoopingCalculatorPage;

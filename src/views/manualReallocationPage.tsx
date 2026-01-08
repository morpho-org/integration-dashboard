import { ChainId, MarketId, MarketParams } from "@morpho-org/blue-sdk";
import React, { useEffect, useRef, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useChainId, useSwitchChain } from "wagmi";
import AmountInput from "../components/AmountInput";
import MarketMetricsChart from "../components/MarketMetricsChart";
import TransactionSenderV2 from "../components/TransactionSenderV2";
import TransactionSimulatorV2 from "../components/TransactionSimulatorV2";
import {
    fetchMarketSimulationBorrow,
    fetchMarketSimulationSeries,
    ReallocationResult,
    WithdrawalDetails
} from "../core/publicAllocator"; // Update with correct path
import { fetchMarketAssets } from "../fetchers/apiFetchers"; // Import the fetchMarketAssets function
import { fetchMarketParams } from "../fetchers/marketIdFetcher"; // Import fetchMarketParams
import { SupportedNetwork } from "../types/networks";
import {
    formatMarketLink,
    formatUsdAmount,
    formatVaultLink,
    getMarketName,
    getNetworkName
} from "../utils/utils";

// SimpleCard component - Downsized
const SimpleCard = ({
  title,
  children,
  initialCollapsed = false,
}: {
  title: string;
  children: React.ReactNode;
  initialCollapsed?: boolean;
}) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  return (
    <div className="text-xs bg-white text-gray-900 rounded-lg shadow-md p-4 mb-4">
      <div
        className="flex items-center cursor-pointer mb-2"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <span className="text-gray-600 mr-2">{isCollapsed ? "\u25bc" : "\u25b2"}</span>
        <h3 className="text-l font-semibold">{title}</h3>
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

// SimpleAlert component - Downsized
const SimpleAlert = ({
  message,
  type = "error",
}: {
  message: string;
  type?: string;
}) => (
  <div
    className={`flex items-center gap-2 p-3 mb-4 rounded-lg text-xs font-medium ${
      type === "error"
        ? "bg-red-50 text-red-800 border border-red-200"
        : "bg-blue-50 text-blue-800 border border-blue-200"
    }`}
  >
    {type === "error" ? (
      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    ) : (
      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" /></svg>
    )}
    {message}
  </div>
);

interface ManualReallocationPageProps {
  network: SupportedNetwork;
}

// Helper functions using the new text sizes
const formatUsdWithStyle = (
  amount: string,
  color?: string,
  reversed?: boolean
) => (
  <span className={`text-l ${color ? color : "text-blue-500"}`}>
    {reversed ? (
      <>
        <span className="text-gray-600">{amount.slice(0, 1)}</span>
        {amount.slice(1)}
      </>
    ) : (
      <>
        {amount.slice(0, -1)}
        <span className="text-gray-600">{amount.slice(-1)}</span>
      </>
    )}
  </span>
);

const formatBorrowApyWithStyle = (apy: string, color?: string) => (
  <span className={`text-l ${color ? color : "text-blue-500"}`}>
    {apy}
    <span className="text-gray-600">%</span>
  </span>
);

const ManualReallocationPage: React.FC<ManualReallocationPageProps> = ({
  network,
}) => {
  const [inputs, setInputs] = useState({
    marketId:
      "",
    requestedLiquidityNative: "1",
    requestedLiquidityUsd: "",
    requestedLiquidityType: "native",
  });

  const [showComputePrompt, setShowComputePrompt] = useState(false);
  const computeButtonRef = useRef<HTMLButtonElement>(null);
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [loading, setLoading] = useState(false);
  const [inputLoading, setInputLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReallocationResult>();
  const [modifiedAmounts, setModifiedAmounts] = useState<{
    [key: string]: string;
  }>({});
  const [marketIdError, setMarketIdError] = useState<string | null>(null);
  const [marketIdSuggestedNetwork, setMarketIdSuggestedNetwork] = useState<number | null>(null);
  const [isLoadingMarketId, setIsLoadingMarketId] = useState<boolean>(false);
  const [marketIdTouched, setMarketIdTouched] = useState<boolean>(false);
  const [marketAsset, setMarketAsset] = useState<{
    loanAsset: { address: string; decimals?: bigint; symbol?: string; priceUsd?: number };
    collateralAsset: { address: string; decimals?: bigint; symbol?: string; priceUsd?: number };
  } | null>(null);
  const [simulationSeries, setSimulationSeries] = useState<{
    percentages: number[];
    initialLiquidity: bigint;
    utilizationSeries: number[];
    apySeries: number[];
    borrowAmounts: bigint[];
    error?: string;
  } | null>(null);
  
  // Network stabilization state
  const [isNetworkStabilizing, setIsNetworkStabilizing] = useState(false);
  const [networkStableChainId, setNetworkStableChainId] = useState<number | null>(null);
  
  // Abort controllers for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

  // Network stabilization effect - prevents race conditions
  useEffect(() => {
    
    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Clear all network-dependent data immediately 
    setResult(undefined);
    setError(null);
    setMarketAsset(null);
    setSimulationSeries(null);
    setMarketIdError(null);
    setMarketIdSuggestedNetwork(null);
    
    // Set stabilization state
    setIsNetworkStabilizing(true);
    setNetworkStableChainId(null);
    
    // Network stabilization period (wait for network to be ready)
    const stabilizationTimer = setTimeout(() => {
      setNetworkStableChainId(chainId);
      setIsNetworkStabilizing(false);
    }, 800); // 800ms stabilization period
    
    return () => {
      clearTimeout(stabilizationTimer);
    };
  }, [chainId, network]);

  // Sequential data fetching - only when network is stable
  useEffect(() => {
    async function fetchSequentialData() {
      if (!networkStableChainId || 
          !inputs.marketId || 
          inputs.marketId.trim() === "" ||
          !inputs.marketId.startsWith('0x') || 
          inputs.marketId.length !== 66 ||
          networkStableChainId !== chainId) {
        
        // If market ID is invalid/empty, clear simulation data but don't show loading
        if (!inputs.marketId || inputs.marketId.trim() === "") {
          setSimulationSeries(null);
          setMarketAsset(null);
          setInputLoading(false);
        }
        return;
      }
      
      
      // Create new abort controller for this fetch cycle
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      
      try {
        setInputLoading(true);
        
        // Step 1: Fetch market assets (contains price data)
        try {
          const assets = await fetchMarketAssets(inputs.marketId, networkStableChainId);
          
          if (signal.aborted) return;
          
          setMarketAsset(assets);
        } catch (assetError) {
          if (signal.aborted) return;
          console.warn(`Could not fetch market assets:`, assetError);
        }
        
        // Step 2: Fetch simulation series (dependent on market existing)
        try {
          const seriesData = await fetchMarketSimulationSeries(
            inputs.marketId as MarketId,
            networkStableChainId
          );
          
          if (signal.aborted) return;
          
          setSimulationSeries(seriesData);
        } catch (seriesError) {
          if (signal.aborted) return;
          console.warn(`⚠️ Could not fetch simulation series:`, seriesError);
          setSimulationSeries(null);
        }
        
      } catch (error) {
        if (signal.aborted) return;
        console.error(`Sequential data fetch failed:`, error);
      } finally {
        if (!signal.aborted) {
          setInputLoading(false);
        }
      }
    }
    
    // Add small delay to ensure network APIs are ready
    const fetchTimer = setTimeout(() => {
      fetchSequentialData();
    }, 200);
    
    return () => {
      clearTimeout(fetchTimer);
    };
  }, [inputs.marketId, networkStableChainId, chainId]);

  useEffect(() => {
    if (result?.simulation?.sourceMarkets) {
      const initialModifiedAmounts =
        result.apiMetrics.publicAllocatorSharedLiquidity.reduce((acc, item) => {
          const key = `${item.vault.address}-${item.allocationMarket.uniqueKey}`;
          const simulationData =
            result.simulation?.sourceMarkets[item.allocationMarket.uniqueKey];
          let amount = simulationData
            ? formatUnits(
                simulationData.preReallocation.liquidity -
                  simulationData.postReallocation.liquidity,
                result.apiMetrics.decimals
              )
            : "0";
          const maxAmount = formatUnits(
            BigInt(item.assets),
            result.apiMetrics.decimals
          );
          if (Number(amount) > Number(maxAmount)) {
            amount = maxAmount;
          }
          acc[key] = amount;
          return acc;
        }, {} as { [key: string]: string });
      setModifiedAmounts(initialModifiedAmounts);
    }
  }, [result]);

  // Market ID validation - only when network is stable
  useEffect(() => {
    async function validateMarketId() {
      if (!inputs.marketId || 
          inputs.marketId.trim() === "" ||
          !inputs.marketId.startsWith('0x') || 
          inputs.marketId.length !== 66 || 
          !marketIdTouched || 
          !networkStableChainId ||
          networkStableChainId !== chainId) {
        setMarketIdError(null);
        setMarketIdSuggestedNetwork(null);
        setIsLoadingMarketId(false);
        return;
      }
      
      setIsLoadingMarketId(true);
      setMarketIdError(null);
      setMarketIdSuggestedNetwork(null);
      
      try {
        const result = await fetchMarketParams(inputs.marketId, networkStableChainId);
        if (result.error) {
          setMarketIdError(result.error);
          if (result.networkSuggestion) {
            setMarketIdSuggestedNetwork(result.networkSuggestion);
          }
          return;
        }
        if (result.params) {
          setMarketIdError(null);
          setMarketIdSuggestedNetwork(null);
        }
      } catch (error) {
        console.error("❌ Error validating market ID:", error);
        setMarketIdError("Error validating market ID. Please try again.");
      } finally {
        setIsLoadingMarketId(false);
      }
    }
    
    // Delay validation to allow network to stabilize
    const validationTimer = setTimeout(validateMarketId, 300);
    return () => clearTimeout(validationTimer);
  }, [inputs.marketId, networkStableChainId, chainId, marketIdTouched]);

  // Auto-validate default market ID on first load
  useEffect(() => {
    if (inputs.marketId && !marketIdTouched) {
      setMarketIdTouched(true);
    }
  }, [inputs.marketId, marketIdTouched]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSwitchNetwork = (networkId: number) => {
    if (switchChain && networkId) {
      const currentMarketId = inputs.marketId;
      
      // Set loading state and clear data immediately
      setIsLoadingMarketId(true);
      setIsNetworkStabilizing(true);
      
      // Switch the network
      switchChain({ chainId: networkId });
      
      // If there's a market ID, mark it as touched so it gets re-validated after network switch
      if (currentMarketId && currentMarketId.startsWith('0x') && currentMarketId.length === 66) {
        setMarketIdTouched(true);
      }
    }
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "marketId") {
      setMarketIdError(null);
      setMarketIdSuggestedNetwork(null);
      setMarketIdTouched(true);
      
      // If market ID is being cleared (empty or invalid), reset everything
      if (!value || value.trim() === "") {
        setInputs((prev) => ({ 
          ...prev, 
          [name]: value,
          requestedLiquidityNative: "1", // Reset to default
          requestedLiquidityUsd: "",     // Clear USD input
          requestedLiquidityType: "native"
        }));
        
        // Clear all derived data
        setMarketAsset(null);
        setSimulationSeries(null);
        setResult(undefined);
        setError(null);
        
        // Cancel any ongoing requests
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        
        return; // Exit early, don't set loading states
      }
      
      setInputs((prev) => ({ ...prev, [name]: value }));
    } else if (name === "requestedLiquidityNative") {
      const numericValue = value.replace(/[^\d]/g, "");
      setInputs((prev) => ({
        ...prev,
        requestedLiquidityNative: numericValue,
        requestedLiquidityType: "native",
        requestedLiquidityUsd: "",
      }));
    } else if (name === "requestedLiquidityUsd") {
      const numericValue = value.replace(/[^\d]/g, "");
      setInputs((prev) => ({
        ...prev,
        requestedLiquidityUsd: numericValue,
        requestedLiquidityType: "usd",
        requestedLiquidityNative: "",
      }));
    } else {
      setInputs((prev) => ({ ...prev, [name]: value }));
    }
    setResult(undefined);
    setError(null);
    setInputLoading(true);
    setTimeout(() => {
      setInputLoading(false);
    }, 500);
  };

  const handleMarketIdPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    setResult(undefined);
    setError(null);
    setMarketIdError(null);
    setMarketIdSuggestedNetwork(null);    
    const pastedText = e.clipboardData.getData('text').trim();
    
    // If pasting empty content, reset everything like clearing the field
    if (!pastedText || pastedText === "") {
      setInputs((prev) => ({ 
        ...prev, 
        marketId: "",
        requestedLiquidityNative: "1",
        requestedLiquidityUsd: "",
        requestedLiquidityType: "native"
      }));
      
      // Clear all derived data
      setMarketAsset(null);
      setSimulationSeries(null);
      
      // Cancel any ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      setMarketIdTouched(true);
      return;
    }
    
    setInputs((prev) => ({ ...prev, marketId: pastedText }));
    setMarketIdTouched(true);
    
    if (pastedText.startsWith('0x') && pastedText.length === 66) {
      setIsLoadingMarketId(true);
    } else {
      setMarketIdError("Invalid market ID format. Should be 0x followed by 64 hex characters.");
    }
  };

  const handleUseMaxAvailable = () => {
    if (marketAsset && simulationSeries) {
      const availableAmount = Number(
        formatUnits(
          (simulationSeries.initialLiquidity * 999n) / 1000n,
          Number(marketAsset.loanAsset.decimals ?? 18)
        )
      ).toFixed(0);
      setInputs((prev) => ({
        ...prev,
        requestedLiquidityNative: availableAmount,
        requestedLiquidityType: "native",
        requestedLiquidityUsd: "",
      }));
      setShowComputePrompt(true);
      if (computeButtonRef.current) {
        computeButtonRef.current.classList.add("pulse-animation");
        setTimeout(() => {
          if (computeButtonRef.current) {
            computeButtonRef.current.classList.remove("pulse-animation");
          }
        }, 1500);
      }
      setTimeout(() => {
        setShowComputePrompt(false);
      }, 5000);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    setResult(undefined);
    try {
      let liquidityValue: bigint;
      if (inputs.requestedLiquidityType === "native") {
        const numericValue = inputs.requestedLiquidityNative.replace(/,/g, "");
        liquidityValue = BigInt(numericValue);
      } else if (inputs.requestedLiquidityType === "usd") {
        if (!marketAsset) throw new Error("Market asset data not loaded. Please try again.");
        const usdValue = Number(inputs.requestedLiquidityUsd.replace(/,/g, ""));
        const priceUsd = marketAsset.loanAsset.priceUsd ?? 0;
        if (priceUsd === 0) throw new Error("Price data not available for this asset.");
        const nativeAmount = (usdValue / priceUsd).toFixed(0);
        liquidityValue = BigInt(nativeAmount);
      } else {
        throw new Error("Invalid liquidity type");
      }
      const res = await fetchMarketSimulationBorrow(
        inputs.marketId as MarketId,
        Number(chainId) as ChainId,
        liquidityValue
      );
      setResult(res);
    } catch (err) {
      console.error("Error in handleSubmit:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAmountChange = (
    vaultAddress: string,
    marketId: string,
    newAmount: string
  ) => {
    const key = `${vaultAddress}-${marketId}`;
    setModifiedAmounts((prev) => ({
      ...prev,
      [key]: newAmount,
    }));
  };

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left side - Input form */}
          <div className="w-full lg:w-1/3">
            <SimpleCard title="Input Parameters">
              <div className="space-y-3">
                <div>
                  <label className="block text-m font-medium mb-1 text-gray-700">
                    Market ID
                    {marketAsset && !marketIdError && chainId && (
                      <span className="ml-2 text-xs font-normal text-blue-600">
                        - found on {getNetworkName(chainId)}
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    name="marketId"
                    value={inputs.marketId}
                    onChange={handleInputChange}
                    onPaste={handleMarketIdPaste}
                    placeholder="Paste market ID (0x...)"
                    className={`w-full px-2 py-1.5 rounded-md border border-gray-300 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                      marketIdError || (inputs.marketId && inputs.marketId.length > 0 && (!inputs.marketId.startsWith('0x') || inputs.marketId.length !== 66)) 
                        ? "border-red-500" 
                        : ""
                    }`}
                  />
                  {inputs.marketId && inputs.marketId.length > 0 && (!inputs.marketId.startsWith('0x') || inputs.marketId.length !== 66) && (
                    <div className="text-red-500 text-xs mt-1">
                      Invalid format! Must be 0x + 64 hex characters
                    </div>
                  )}
                  {(isLoadingMarketId || isNetworkStabilizing) && (
                    <div className="text-gray-600 text-xs mt-1">
                      {isNetworkStabilizing ? (
                        <span>🔄 Network stabilizing...</span>
                      ) : (
                        <span>🔍 Validating market ID...</span>
                      )}
                    </div>
                  )}
                  {marketIdError && (
                    <div className="mt-2">
                      {marketIdError === "Market not found on the current network." && marketIdSuggestedNetwork ? (
                        <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-lg">
                          <div className="flex items-center mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <span className="text-blue-800 text-xs">
                              Market found on {getNetworkName(marketIdSuggestedNetwork)}
                            </span>
                          </div>
                          <button
                            onClick={() => handleSwitchNetwork(marketIdSuggestedNetwork)}
                            disabled={isNetworkStabilizing}
                            className={[
                              "w-full py-1.5 px-2 text-white text-xs font-semibold rounded-md",
                              "transition-colors duration-200 flex items-center justify-center",
                              isNetworkStabilizing ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700",
                            ].join(" ")}
                          >
                            {isNetworkStabilizing ? (
                              "Switching..."
                            ) : (
                              <>
                                <span className="mr-1">Switch to</span>
                                {getNetworkName(marketIdSuggestedNetwork)}
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="text-red-500 text-xs">
                          {marketIdError}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-m font-medium mb-1 text-gray-700">
                    Borrow Request Liquidity (native units)
                  </label>
                  <input
                    type="text"
                    name="requestedLiquidityNative"
                    value={Number(
                      inputs.requestedLiquidityNative
                    ).toLocaleString()}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1.5 rounded-md border border-gray-300 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-m font-medium mb-1 text-gray-700">
                    Borrow Request Liquidity (USD)
                  </label>
                  <input
                    type="text"
                    name="requestedLiquidityUsd"
                    value={Number(inputs.requestedLiquidityUsd).toLocaleString()}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1.5 rounded-md border border-gray-300 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>

                <button
                  ref={computeButtonRef}
                  onClick={handleSubmit}
                  disabled={loading}
                  className={`w-full bg-[#5792FF] text-l text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition relative ${
                    showComputePrompt
                      ? "ring-2 ring-yellow-400 ring-opacity-75"
                      : ""
                  }`}
                >
                  {loading
                    ? "Computing..."
                    : "Compute Reallocation"}
                </button>

                {showComputePrompt && (
                  <div className="text-yellow-500 text-xs text-center animate-fade-in mt-2">
                    ⚠️ Click &quot;Compute Reallocation&quot; to see the results
                  </div>
                )}

                {result && result.apiMetrics && (
                  <div className="mt-3 p-2 bg-gray-50 rounded-lg text-xs border border-gray-200">
                    <p className="text-gray-700">
                      Requested Amount:{" "}
                      <span className="text-red-500 font-bold text-m">
                        {formatUsdWithStyle(
                          formatUsdAmount(
                            Number(
                              inputs.requestedLiquidityType === "native"
                                ? Number(inputs.requestedLiquidityNative) *
                                    result.apiMetrics.priceUsd
                                : Number(inputs.requestedLiquidityUsd)
                            ),
                            2
                          ),
                          "text-red-500"
                        )}
                      </span>
                    </p>
                    <p className="text-gray-700">
                      Token:{" "}
                      <span className="text-blue-600 font-semibold text-m">
                        {result.apiMetrics.symbol}
                      </span>
                    </p>
                    <p className="text-gray-700">
                      Price:{" "}
                      <span className="text-blue-600 font-semibold text-m">
                        ${result.apiMetrics.priceUsd.toFixed(2)}
                      </span>
                    </p>
                    <p className="text-gray-700">
                      Decimals:{" "}
                      <span className="text-blue-600 font-semibold text-m">
                        {result.apiMetrics.decimals}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </SimpleCard>
          </div>

          {/* Right side with two sections */}
          <div className="w-full lg:w-2/3 flex flex-col gap-6">
            <SimpleCard
              title="Market Graph with Borrow Simulation"
              initialCollapsed={false}
            >
              <div className="p-0">
                {isNetworkStabilizing ? (
                  <div className="p-2 bg-blue-50 text-blue-600 text-xs rounded flex items-center">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                    Network stabilizing, preparing market data...
                  </div>
                ) : inputLoading ? (
                  <div className="p-2 bg-blue-50 text-blue-600 text-xs rounded flex items-center">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                    Loading market graph...
                  </div>
                ) : !inputs.marketId || inputs.marketId.trim() === "" ? (
                  <div className="p-2 bg-gray-100 text-gray-600 text-xs rounded">
                    📝 Enter a market ID above to see the borrow simulation graph
                  </div>
                ) : !simulationSeries || simulationSeries.error ? (
                  <div className="p-2 bg-yellow-400/10 text-yellow-800 text-xs rounded">
                    ⚠️ Price data unavailable for this market on the current chain. Some USD values may not display correctly.
                    <div className="mt-1">Try switching networks or wait a moment for data to load.</div>
                  </div>
                ) : simulationSeries.utilizationSeries.every((u) => u === 0) ? (
                  <div className="p-2 bg-yellow-400/10 text-yellow-400 text-xs rounded">
                    ⚠️ This market has no liquidity data. Try switching networks.
                  </div>
                ) : (
                  <MarketMetricsChart
                    simulationSeries={simulationSeries}
                    marketAsset={marketAsset}
                    onUseMaxAvailable={handleUseMaxAvailable}
                    loading={inputLoading}
                  />
                )}
              </div>
            </SimpleCard>
            {(loading || inputLoading || isNetworkStabilizing) && (
              <div className="flex items-center justify-center p-6 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
                {isNetworkStabilizing ? "Network stabilizing..." : loading ? "Computing..." : "Loading data..."}
              </div>
            )}

            {!loading && !inputLoading && !isNetworkStabilizing && (
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
                        <div className="grid grid-cols-5 gap-3 text-m">
                          <div>
                            <h4 className="text-xs text-gray-600 mb-1">
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
                            <h4 className="text-xs text-gray-600 mb-1">
                              Reallocatable
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
                            <h4 className="text-xs text-gray-600 mb-1">
                              Reallocated
                            </h4>
                            {formatUsdWithStyle(
                              formatUsdAmount(
                                Object.values(
                                  result.simulation?.sourceMarkets || {}
                                ).reduce(
                                  (sum, market) =>
                                    sum +
                                    Number(
                                      formatUnits(
                                        market.preReallocation.liquidity -
                                          market.postReallocation.liquidity,
                                        result.apiMetrics.decimals
                                      )
                                    ),
                                  0
                                ) * result.apiMetrics.priceUsd,
                                2
                              )
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs text-gray-600 mb-1">
                              Matched
                            </h4>
                            <span className="text-l">
                              {result.reallocation.isLiquidityFullyMatched
                                ? "Yes ✅"
                                : "No ❌"}
                            </span>
                          </div>
                          <div>
                            <h4 className="text-xs text-gray-600 mb-1">
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
                        {/* Target Market Section */}
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-gray-700 font-medium text-m">Target Market:</span>
                            <a
                              href={formatMarketLink(inputs.marketId, Number(chainId))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-800 font-semibold underline hover:text-blue-900 text-l"
                            >
                              {getMarketName(result.apiMetrics.loanAsset.symbol,result.apiMetrics.collateralAsset?.symbol,result.apiMetrics.lltv)}
                            </a>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-m">
                            <div>
                              <p className="text-gray-500 font-medium text-xs mb-1">Current Liq.</p>
                              <div className="flex items-baseline">
                                <span className="text-gray-500 text-xs w-12">- onchain</span>
                                <span className="text-blue-700 font-bold text-l ml-2">
                                  {formatUsdWithStyle(formatUsdAmount(Number(formatUnits(result.currentMarketLiquidity,result.apiMetrics.decimals)) * result.apiMetrics.priceUsd,2))}
                                </span>
                              </div>
                            </div>
                            <div>
                              <p className="text-gray-500 font-medium text-xs mb-1">Reallocatable Liq.</p>
                              <span className="text-blue-700 font-bold text-l">
                                {formatUsdWithStyle(formatUsdAmount(Number(formatUnits(result.apiMetrics.reallocatableLiquidity,result.apiMetrics.decimals)) * result.apiMetrics.priceUsd,2))}
                              </span>
                            </div>
                            {result.apiMetrics.maxBorrowWithoutReallocation ? (
                              <div className="col-span-2">
                                <p className="text-gray-500 font-medium text-xs mb-1">Max Borrow (no reallocation)</p>
                                <span className="text-blue-700 font-bold text-m">
                                  {Number(formatUnits(result.apiMetrics.maxBorrowWithoutReallocation,result.apiMetrics.decimals)).toFixed(2)} units → {formatUsdWithStyle(formatUsdAmount(Number(formatUnits(result.apiMetrics.maxBorrowWithoutReallocation,result.apiMetrics.decimals)) * result.apiMetrics.priceUsd,2))}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        {/* Source Markets Section */}
                        <div>
                          <h3 className="text-l font-bold text-blue-900 mb-2">Source Markets</h3>
                           <div className=" text-xs grid grid-cols-4 gap-2 mb-2 px-2">
                              <div className="text-gray-500 font-semibold text-xs">Vault</div>
                              <div className="text-gray-500 font-semibold text-xs">Market</div>
                              <div className="text-gray-500 font-semibold text-xs">Reallocatable</div>
                              <div className="text-gray-500 font-semibold text-xs">Util / Target</div>
                          </div>
                          <div className="space-y-2 text-m">
                            {Object.entries(result.apiMetrics.publicAllocatorSharedLiquidity.reduce((acc, item) => {
                                const vaultName = item.vault.name;
                                if (!acc[vaultName]) {
                                  acc[vaultName] = { markets: [], vaultAddress: item.vault.address };
                                }
                                acc[vaultName].markets.push(item);
                                return acc;
                              },{} as Record<string,{markets: typeof result.apiMetrics.publicAllocatorSharedLiquidity; vaultAddress: string;}>
                              )
                            ).map(([vaultName, data]) => (
                              <div key={vaultName} className="bg-blue-50/50 rounded-md p-2">
                                <div className="grid grid-cols-4 gap-2 items-center">
                                  <div>
                                    <a href={formatVaultLink(data.vaultAddress, Number(chainId))} target="_blank" rel="noopener noreferrer" className="text-blue-800 font-semibold underline hover:text-blue-900 text-m">
                                      {vaultName}
                                    </a>
                                  </div>
                                  <div>
                                    {data.markets.map((market) => (
                                      <a key={market.allocationMarket.uniqueKey} href={formatMarketLink(market.allocationMarket.uniqueKey,Number(chainId))} target="_blank" rel="noopener noreferrer" className="block text-gray-800 hover:text-blue-900 text-xs">
                                        {`${getMarketName(market.allocationMarket.loanAsset.symbol,market.allocationMarket.collateralAsset?.symbol,BigInt(market.allocationMarket.lltv))}`}
                                      </a>
                                    ))}
                                  </div>
                                  <div>
                                    {data.markets.map((market) => (
                                      <p key={market.allocationMarket.uniqueKey} className="text-blue-700 font-bold text-m">
                                        {formatUsdWithStyle(formatUsdAmount(Number(formatUnits(BigInt(market.assets),result.apiMetrics.decimals)) * result.apiMetrics.priceUsd,2))}
                                      </p>
                                    ))}
                                  </div>
                                  <div>
                                    {data.markets.map((market) => (
                                      <p key={market.allocationMarket.uniqueKey} className="text-gray-700 font-medium text-xs">
                                        {(market.allocationMarket.state.utilization * 100).toFixed(1)}% / {(Number(formatUnits(BigInt(market.allocationMarket.targetWithdrawUtilization),18)) * 100).toFixed(1)}%
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                    </SimpleCard>

                    <SimpleCard title="Simulation Results">
                      <div className="space-y-4">
                        <div className="grid grid-cols-6 gap-3">
                          <div className="text-xs font-medium text-gray-600">Market</div>
                          <div className="text-xs font-medium text-gray-600">Metric</div>
                          <div className="text-xs font-medium text-gray-600">Pre-Realloc</div>
                          <div className="text-xs font-medium text-gray-600">Post-Realloc</div>
                          <div className="text-xs font-medium text-gray-600">Post-Borrow</div>
                        </div>

                        {result.simulation ? (
                          <div className="text-xs">
                            <div className="text-m font-medium text-blue-500 mb-2">Target Market</div>
                            <div className="grid grid-cols-6 gap-3 items-start">
                              <div>
                                <a href={formatMarketLink(inputs.marketId,Number(chainId))} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-blue-500">
                                  {`${getMarketName(result.apiMetrics.loanAsset.symbol,result.apiMetrics.collateralAsset?.symbol,result.apiMetrics.lltv)}`}
                                </a>
                              </div>
                              <div className="space-y-2 text-gray-500">
                                <div>Liquidity</div>
                                <div>Borrow APY</div>
                                <div>Utilization</div>
                              </div>
                              {/* Pre-Reallocation */}
                              <div className="space-y-2 text-m">
                                <div>{formatUsdWithStyle(formatUsdAmount(Number(formatUnits(result.simulation.targetMarket.preReallocation.liquidity,result.apiMetrics.decimals)) * result.apiMetrics.priceUsd,2))}</div>
                                <div>{formatBorrowApyWithStyle(Number(formatUnits(result.simulation.targetMarket.preReallocation.borrowApy,16)).toFixed(2))}</div>
                                <div>{formatBorrowApyWithStyle(Number(formatUnits(result.simulation.targetMarket.preReallocation.utilization,16)).toFixed(2))}</div>
                              </div>
                              {/* Post-Reallocation */}
                              <div className="space-y-2 text-m">
                                <div>
                                  {formatUsdWithStyle(formatUsdAmount(Number(formatUnits(result.simulation.targetMarket.postReallocation.liquidity,result.apiMetrics.decimals)) * result.apiMetrics.priceUsd,2))}
                                  <span className="text-red-400 ml-1 text-xs">
                                    {`(+${formatUsdAmount(Number(formatUnits(result.simulation.targetMarket.postReallocation.liquidity - result.simulation.targetMarket.preReallocation.liquidity,result.apiMetrics.decimals)) * result.apiMetrics.priceUsd,0)})`}
                                  </span>
                                </div>
                                <div>-</div>
                                <div>-</div>
                              </div>
                              {/* Post-Borrow */}
                              <div className="space-y-2 text-m">
                                <div>{formatUsdWithStyle(formatUsdAmount(Number(formatUnits(result.simulation.targetMarket.postBorrow.liquidity,result.apiMetrics.decimals)) * result.apiMetrics.priceUsd,2))}</div>
                                <div>
                                  {formatBorrowApyWithStyle(Number(formatUnits(result.simulation.targetMarket.postBorrow.borrowApy,16)).toFixed(2))}
                                </div>
                                <div>
                                  {formatBorrowApyWithStyle(Number(formatUnits(result.simulation.targetMarket.postBorrow.utilization,16)).toFixed(2))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {result.simulation?.sourceMarkets && Object.keys(result.simulation.sourceMarkets).length > 0 ? (
                          <div className="text-xs">
                            <div className="text-m font-medium text-blue-500 my-2">Source Markets</div>
                            {Object.entries(result.simulation.sourceMarkets).map(([marketId, sim]) => {
                                const marketInfo = result.apiMetrics.publicAllocatorSharedLiquidity.find(m => m.allocationMarket.uniqueKey === marketId);
                                if (!marketInfo) return null;
                                return (
                                <div key={marketId} className="grid grid-cols-6 gap-3 items-start border-t border-gray-200 pt-2 mt-2">
                                  <div>
                                    <a href={formatMarketLink(marketId, Number(chainId))} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-blue-500">
                                      {`${getMarketName(marketInfo.allocationMarket.loanAsset.symbol, marketInfo.allocationMarket.collateralAsset?.symbol, BigInt(marketInfo.allocationMarket.lltv))}`}
                                    </a>
                                  </div>
                                  <div className="space-y-2 text-gray-500">
                                      <div>Liquidity</div>
                                      <div>Borrow APY</div>
                                      <div>Utilization</div>
                                  </div>
                                   {/* Pre-Reallocation */}
                                  <div className="space-y-2 text-m">
                                      <div>{formatUsdWithStyle(formatUsdAmount(Number(formatUnits(sim.preReallocation.liquidity,result.apiMetrics.decimals)) * result.apiMetrics.priceUsd,2))}</div>
                                      <div>{formatBorrowApyWithStyle(Number(formatUnits(sim.preReallocation.borrowApy,16)).toFixed(2))}</div>
                                      <div>{formatBorrowApyWithStyle(Number(formatUnits(sim.preReallocation.utilization,16)).toFixed(2))}</div>
                                  </div>
                                   {/* Post-Reallocation */}
                                  <div className="space-y-2 text-m">
                                      <div>
                                        {formatUsdWithStyle(formatUsdAmount(Number(formatUnits(sim.postReallocation.liquidity,result.apiMetrics.decimals)) * result.apiMetrics.priceUsd,2))}
                                        <span className="text-green-500 ml-1 text-xs">({`${formatUsdAmount(Number(formatUnits(sim.postReallocation.liquidity - sim.preReallocation.liquidity,result.apiMetrics.decimals)) * result.apiMetrics.priceUsd,0)}`})</span>
                                      </div>
                                      <div>{formatBorrowApyWithStyle(Number(formatUnits(sim.postReallocation.borrowApy,16)).toFixed(2))}</div>
                                      <div>{formatBorrowApyWithStyle(Number(formatUnits(sim.postReallocation.utilization,16)).toFixed(2))}</div>
                                  </div>
                                   {/* Post-Borrow */}
                                   <div className="space-y-2 text-m"><div>-</div><div>-</div><div>-</div></div>
                                </div>
                              )
                            })}
                          </div>
                        ) : null}
                      </div>
                    </SimpleCard>

                    <SimpleCard title="Reallocation Execution">
                      <div className="space-y-3">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                              <tr>
                                <th className="px-3 py-2 text-left text-xs text-gray-600">Vault / Market</th>
                                <th className="px-3 py-2 text-left text-xs text-gray-600">Max Reallocatable</th>
                                <th className="px-3 py-2 text-left text-xs text-gray-600">Current Util.</th>
                                <th className="px-3 py-2 text-left text-xs text-gray-600">Amount to Reallocate</th>
                                <th className="px-3 py-2 text-left text-xs text-gray-600">Value (USD)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 text-xs">
                              {result.apiMetrics.publicAllocatorSharedLiquidity.map(
                                (item) => (
                                  <tr key={`${item.vault.address}-${item.allocationMarket.uniqueKey}`} className="hover:bg-gray-50">
                                    <td className="px-3 py-2">
                                      <a href={formatVaultLink(item.vault.address,Number(chainId))} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold block">{item.vault.name}</a>
                                      <a href={formatMarketLink(item.allocationMarket.uniqueKey,Number(chainId))} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:underline">
                                        {getMarketName(item.allocationMarket.loanAsset.symbol,item.allocationMarket.collateralAsset?.symbol,BigInt(item.allocationMarket.lltv))}
                                      </a>
                                    </td>
                                    <td className="px-3 py-2 text-m font-semibold">
                                        {formatUsdAmount(Number(formatUnits(BigInt(item.assets),result.apiMetrics.decimals)) * result.apiMetrics.priceUsd,2)}
                                      <span className="block text-gray-600 font-normal text-xs">
                                        ({Number(formatUnits(BigInt(item.assets),result.apiMetrics.decimals)).toFixed(2)} {result.apiMetrics.symbol})
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-m">
                                      {(item.allocationMarket.state.utilization * 100).toFixed(2)}%
                                    </td>
                                    <td className="px-3 py-2">
                                      <AmountInput
                                        value={modifiedAmounts[`${item.vault.address}-${item.allocationMarket.uniqueKey}`] || "0"}
                                        onChange={(newAmount) => handleAmountChange(item.vault.address, item.allocationMarket.uniqueKey, newAmount)}
                                        maxValue={formatUnits(BigInt(item.assets), result.apiMetrics.decimals)}
                                        symbol={result.apiMetrics.symbol}
                                        decimals={result.apiMetrics.decimals}
                                        displayDecimals={2}
                                        className="w-40"
                                        placeholder="0"
                                      />
                                    </td>
                                    <td className="px-3 py-2 text-m font-semibold">
                                      {modifiedAmounts[`${item.vault.address}-${item.allocationMarket.uniqueKey}`] ? (
                                        <>
                                          {formatUsdAmount(Number(modifiedAmounts[`${item.vault.address}-${item.allocationMarket.uniqueKey}`]) * result.apiMetrics.priceUsd,2)}
                                          <span className="block text-gray-600 font-normal text-xs">
                                            ({Number(modifiedAmounts[`${item.vault.address}-${item.allocationMarket.uniqueKey}`]).toFixed(2)} {result.apiMetrics.symbol})
                                          </span>
                                        </>
                                      ) : ("-")}
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex justify-end gap-3 mt-3">
                          <TransactionSimulatorV2
                            networkId={Number(chainId)}
                            marketId={inputs.marketId as MarketId}
                            withdrawalsPerVault={Object.entries(modifiedAmounts).reduce((acc, [key, amount]) => {
                                const [vaultAddress, marketId] = key.split("-");
                                if (!acc[vaultAddress]) acc[vaultAddress] = [];
                                if (amount && Number(amount) > 0) {
                                  acc[vaultAddress].push({ marketId: marketId as MarketId, amount: parseUnits(amount,result.apiMetrics.decimals), marketParams: MarketParams.get(marketId as MarketId), sourceMarketLiquidity: BigInt(0) });
                                }
                                return acc;
                              }, {} as { [vaultAddress: string]: WithdrawalDetails[] })}
                          />
                          <TransactionSenderV2
                            networkId={Number(chainId)}
                            marketId={inputs.marketId as MarketId}
                            withdrawalsPerVault={Object.entries(modifiedAmounts).reduce((acc, [key, amount]) => {
                                const [vaultAddress, marketId] = key.split("-");
                                if (!acc[vaultAddress]) acc[vaultAddress] = [];
                                if (amount && Number(amount) > 0) {
                                  acc[vaultAddress].push({ marketId: marketId as MarketId, amount: parseUnits(amount,result.apiMetrics.decimals), marketParams: MarketParams.get(marketId as MarketId), sourceMarketLiquidity: BigInt(0) });
                                }
                                return acc;
                              }, {} as { [vaultAddress: string]: WithdrawalDetails[] })}
                          />
                        </div>
                      </div>
                    </SimpleCard>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
          50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
        .pulse-animation { animation: pulse 0.75s 2; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
      `}</style>
    </div>
  );
};

export default ManualReallocationPage;
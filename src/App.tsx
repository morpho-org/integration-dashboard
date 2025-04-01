import React, { useState } from "react";
import NavBar from "./components/NavBar";
import { Route, Routes } from "react-router-dom";
import VaultPage from "./pages/vaultPage";
import OutOfBoundsMarketsPage from "./pages/outOfBoundsMarketsPage";
import MarketWarningsPage from "./pages/marketWarningsPage";
import MarketsWithoutStrategyPage from "./pages/marketWithoutStrategyPage";
import BlockingFlowCapsPage from "./pages/blockingFlowCapsPage";
import ManualReallocationPage from "./pages/manualReallocationPage";
const App: React.FC = () => {
  const [network, setNetwork] = useState<"ethereum" | "base">("ethereum");

  const handleNetworkSwitch = (selectedNetwork: "ethereum" | "base") => {
    setNetwork(selectedNetwork);
  };

  return (
    <div className="w-full p-1 bg-[#222529]">
      <div className="w-full h-15 px-4 justify-between items-center">
        <NavBar
          currentNetwork={network}
          onNetworkSwitch={handleNetworkSwitch}
        />
      </div>
      <div
        className="p-3 rounded-t-lg min-h-screen"
        style={{
          background:
            "linear-gradient(180deg, rgba(21, 24, 26, 0.00) 63.77%, rgba(255, 255, 255, 0.04) 89.72%), var(--Background-Base, #15181A)",
        }}
      >
        <Routes>
          <Route
            path="/manual-reallocation"
            element={<ManualReallocationPage network={network} />}
          />{" "}
          <Route path="/" element={<VaultPage network={network} />} />
          <Route
            path="/out-of-bounds-markets"
            element={<OutOfBoundsMarketsPage network={network} />}
          />
          <Route
            path="/market-warnings"
            element={<MarketWarningsPage network={network} />}
          />{" "}
          <Route
            path="/markets-without-strategy"
            element={<MarketsWithoutStrategyPage network={network} />}
          />{" "}
          <Route
            path="/blocking-flow-caps"
            element={<BlockingFlowCapsPage network={network} />}
          />{" "}
        </Routes>
      </div>
    </div>
  );
};

export default App;

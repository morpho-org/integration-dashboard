import React, { useState } from "react";
import NavBar from "./components/NavBar";
import { Route, Routes } from "react-router-dom";
import FlowCapsPage from "./pages/flowCapsPage";
import OutOfBoundsMarketsPage from "./pages/outOfBoundsMarketsPage";

const App: React.FC = () => {
  const [network, setNetwork] = useState<"ethereum" | "base">("ethereum");

  const handleNetworkSwitch = () => {
    setNetwork((prevNetwork) =>
      prevNetwork === "ethereum" ? "base" : "ethereum"
    );
  };

  return (
    <div className="App">
      <NavBar currentNetwork={network} onNetworkSwitch={handleNetworkSwitch} />
      <Routes>
        <Route path="/" element={<FlowCapsPage network={network} />} />
        <Route
          path="/out-of-bounds-markets"
          element={<OutOfBoundsMarketsPage network={network} />}
        />
      </Routes>
    </div>
  );
};

export default App;

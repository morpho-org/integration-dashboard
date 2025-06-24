import React, { useState } from "react";
import NavBar from "./components/NavBar";
import { Route, Routes } from "react-router-dom";
import ManualReallocationPage from "./pages/manualReallocationPage";
const App: React.FC = () => {
  const [network, setNetwork] = useState<"ethereum" | "base" | "polygon" | "unichain">("ethereum");

  const handleNetworkSwitch = (selectedNetwork: "ethereum" | "base" | "polygon" | "unichain") => {
    setNetwork(selectedNetwork);
  };

  return (
    <div className="w-full p-1 bg-[#F9FAFB]">
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
            "linear-gradient(180deg, rgba(21, 24, 26, 0.00) 63.77%, rgba(255, 255, 255, 0.04) 89.72%), var(--Background-Base, #F9FAFB)",
        }}
      >
        <Routes>
          <Route
            path="/"
            element={<ManualReallocationPage network={network} />}
          />
          <Route
            path="/manual-reallocation"
            element={<ManualReallocationPage network={network} />}
          />
        </Routes>
      </div>
    </div>
  );
};

export default App;

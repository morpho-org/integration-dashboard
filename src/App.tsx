import React, { useState } from "react";
import styled from "styled-components";
import NavBar from "./components/NavBar";
import { Route, Routes } from "react-router-dom";
import VaultPage from "./pages/vaultPage";
import OutOfBoundsMarketsPage from "./pages/outOfBoundsMarketsPage";
import wallpaper from "./logos/wallpaper.png";
import MarketWarningsPage from "./pages/marketWarningsPage";
import MarketsWithoutStrategyPage from "./pages/marketWithoutStrategyPage";

const ContentWrapper = styled.div`
  // background-image: url(${wallpaper});
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;
  min-height: 100vh;
  padding: 60px;
  overflow-y: auto;
`;

const SecondContentWrapper = styled.div`
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  overflow-y: auto;
  height: 100vh;
`;
const App: React.FC = () => {
  const [network, setNetwork] = useState<"ethereum" | "base">("ethereum");

  const handleNetworkSwitch = () => {
    setNetwork((prevNetwork) =>
      prevNetwork === "ethereum" ? "base" : "ethereum"
    );
  };

  return (
    <div>
      <NavBar currentNetwork={network} onNetworkSwitch={handleNetworkSwitch} />
      <ContentWrapper>
        <SecondContentWrapper>
          <Routes>
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
          </Routes>
        </SecondContentWrapper>
      </ContentWrapper>
    </div>
  );
};

export default App;

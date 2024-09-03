import React, { useState } from "react";
import styled from "styled-components";
import NavBar from "./components/NavBar";
import { Route, Routes } from "react-router-dom";
import VaultPage from "./pages/vaultPage";
import OutOfBoundsMarketsPage from "./pages/outOfBoundsMarketsPage";
import wallpaper from "./logos/wallpaper.png";

const ContentWrapper = styled.div`
  background-image: url(${wallpaper});
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;
  min-height: 100vh;
  padding: 20px;
  overflow-y: auto;
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
        <Routes>
          <Route path="/" element={<VaultPage network={network} />} />
          <Route
            path="/out-of-bounds-markets"
            element={<OutOfBoundsMarketsPage network={network} />}
          />
        </Routes>
      </ContentWrapper>
    </div>
  );
};

export default App;

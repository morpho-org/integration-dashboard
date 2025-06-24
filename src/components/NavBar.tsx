import React from "react";
import styled from "styled-components";
import { useChainId } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const NavBarWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #5792FF;
  padding: 10px 10px;
  color: #2470ff;
  border-radius: 10px;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
`;


const NetworkContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: auto;
  max-height: 45px;
`;


type NavBarProps = {
  currentNetwork: "ethereum" | "base" | "polygon" | "unichain";
  onNetworkSwitch: (network: "ethereum" | "base" | "polygon" | "unichain") => void;
};

const NavBar: React.FC<NavBarProps> = ({ currentNetwork, onNetworkSwitch }) => {
  const chainId = useChainId();
  
  // Map chainId to network name
  const getNetworkFromChainId = (chainId: number): "ethereum" | "base" | "polygon" | "unichain" => {
    switch (chainId) {
      case 1: return "ethereum";
      case 8453: return "base";
      case 137: return "polygon";
      case 130: return "unichain";
      default: return "ethereum";
    }
  };

  // Use connected wallet's chainId as the current network
  const connectedNetwork = getNetworkFromChainId(chainId);
  
  // Update parent when chainId changes (with debouncing to prevent loops)
  React.useEffect(() => {
    if (connectedNetwork !== currentNetwork) {
      // Add a small delay to prevent rapid switching
      const timeoutId = setTimeout(() => {
        onNetworkSwitch(connectedNetwork);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [connectedNetwork, currentNetwork, onNetworkSwitch]);

  return (
    <NavBarWrapper>
      <Title>Manual Reallocation</Title>
      <NetworkContainer>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <ConnectButton />
        </div>
      </NetworkContainer>
    </NavBarWrapper>
  );
};

export default NavBar;

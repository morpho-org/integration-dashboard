import React, { useState } from "react";
import styled from "styled-components";
import { Link, useLocation } from "react-router-dom";
import { useChainId, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const NavBarWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #191d200f;
  padding: 10px 10px;
  color: #2470ff;
`;

const NavLinks = styled.div`
  display: flex;
  align-items: center;
  background-color: #2c2f33;
  border-radius: 9999px;
  height: 45px;
  white-space: nowrap;
`;

const NavLink = styled(Link)<{ $isActive: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${(props) => (props.$isActive ? "#ffffff" : "#a0a0a0")};
  background-color: ${(props) => (props.$isActive ? "#2973FF" : "transparent")};
  border-radius: 9999px;
  padding: 8px 16px;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  height: 100%;
  transition: all 0.3s;
  &:hover {
    background-color: ${(props) => (props.$isActive ? "#2973FF" : "#3a3f45")};
  }
`;

export const NetworkSelector = styled.div`
  display: flex;
  align-items: center;
  background-color: #2c2f33;
  border-radius: 9999px;
  height: 45px;
  /* Remove margin-left:auto here */
`;

export const NetworkButton = styled.button<{ $isActive: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${(props) => (props.$isActive ? "#ffffff" : "#a0a0a0")};
  background-color: ${(props) => (props.$isActive ? "#2973FF" : "transparent")};
  border-radius: 9999px;
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  height: 100%;
  transition: all 0.3s;
  border: none;
  cursor: pointer;
  &:hover {
    background-color: ${(props) => (props.$isActive ? "#2973FF" : "#3a3f45")};
  }
`;

export const ethLogo = "https://cdn.morpho.org/assets/chains/eth.svg";
export const baseLogo = "https://cdn.morpho.org/assets/chains/base.png";
export const polygonLogo = "https://cdn.morpho.org/assets/chains/polygon.svg";
export const unichainLogo = "https://cdn.morpho.org/assets/chains/unichain.svg";

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
  const location = useLocation();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [isSwitching, setIsSwitching] = useState(false);
  
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
    if (!isSwitching && connectedNetwork !== currentNetwork) {
      // Add a small delay to prevent rapid switching
      const timeoutId = setTimeout(() => {
        onNetworkSwitch(connectedNetwork);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [connectedNetwork, currentNetwork, onNetworkSwitch, isSwitching]);

  const navItems = [
    { path: "/manual-reallocation", label: "Manual Reallocation" },
    { path: "/", label: "Vaults" },
    { path: "/market-warnings", label: "Markets With Warnings" },
    { path: "/markets-without-strategy", label: "Strategyless Markets" },
    { path: "/out-of-bounds-markets", label: "Out of Range Markets" },
    { path: "/blocking-flow-caps", label: "Blocking Flow Caps" },
  ];

  return (
    <NavBarWrapper>
      <NavLinks>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            $isActive={location.pathname === item.path}
          >
            {item.label}
          </NavLink>
        ))}
      </NavLinks>
      <NetworkContainer>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <ConnectButton />
        </div>
      </NetworkContainer>
    </NavBarWrapper>
  );
};

export default NavBar;

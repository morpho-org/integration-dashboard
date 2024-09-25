import React, { useState } from "react";
import styled from "styled-components";
import { Link, useLocation } from "react-router-dom";
import Select, { ActionMeta } from "react-select";

const NavBarWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #191d200f;
  padding: 10px 20px;
  color: #2470ff;
`;

const NavLinks = styled.div`
  display: flex;
  align-items: center;
  background-color: #2c2f33;
  border-radius: 9999px;
  height: 45px;
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

const NetworkSelector = styled.div`
  display: flex;
  align-items: center;
  background-color: #2c2f33;
  border-radius: 9999px;
  height: 45px;
  margin-left: auto;
`;

const NetworkButton = styled.button<{ $isActive: boolean }>`
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
  border: none;
  cursor: pointer;

  &:hover {
    background-color: ${(props) => (props.$isActive ? "#2973FF" : "#3a3f45")};
  }
`;

const ethLogo = "https://cdn.morpho.org/assets/chains/eth.svg";
const baseLogo = "https://cdn.morpho.org/assets/chains/base.png";

type NetworkOption = {
  value: "ethereum" | "base";
  label: JSX.Element;
};

const networkOptions: NetworkOption[] = [
  {
    value: "ethereum",
    label: (
      <div style={{ display: "flex", alignItems: "center" }}>
        <img
          src={ethLogo}
          alt="Ethereum"
          style={{ width: 20, height: 20, marginRight: 10 }}
        />
        Ethereum
      </div>
    ),
  },
  {
    value: "base",
    label: (
      <div style={{ display: "flex", alignItems: "center" }}>
        <img
          src={baseLogo}
          alt="Base"
          style={{ width: 20, height: 20, marginRight: 10 }}
        />
        Base
      </div>
    ),
  },
];

type NavBarProps = {
  currentNetwork: "ethereum" | "base";
  onNetworkSwitch: (network: "ethereum" | "base") => void;
};

const NavBar: React.FC<NavBarProps> = ({ currentNetwork, onNetworkSwitch }) => {
  const location = useLocation();
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkOption>(
    networkOptions.find((option) => option.value === currentNetwork) ||
      networkOptions[0]
  );

  const handleNetworkChange = (network: "ethereum" | "base") => {
    const option = networkOptions.find((opt) => opt.value === network);
    if (option) {
      setSelectedNetwork(option);
      onNetworkSwitch(network);
    }
  };

  const navItems = [
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
      <NetworkSelector>
        {networkOptions.map((option) => (
          <NetworkButton
            key={option.value}
            $isActive={selectedNetwork.value === option.value}
            onClick={() => handleNetworkChange(option.value)}
          >
            {option.label}
          </NetworkButton>
        ))}
      </NetworkSelector>
    </NavBarWrapper>
  );
};

export default NavBar;

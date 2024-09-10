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
  gap: 15px;
`;

const NavLink = styled(Link)<{ $isActive: boolean }>`
  color: ${(props) => (props.$isActive ? "#ffffff" : "#191b20")};
  border-radius: 6px;
  background-color: ${(props) => (props.$isActive ? "#2470ff" : "#191d200f")};
  padding: 10px 8px;
  text-decoration: none;
  font-size: 1.1em;
  margin-left: 40px;

  &:hover {
    text-decoration: ${(props) => (props.$isActive ? "none" : "underline")};
  }
`;

const NetworkSelect = styled(Select)`
  width: 200px;
  margin-left: auto;
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

  const handleNetworkChange = (
    option: NetworkOption | null,
    actionMeta: ActionMeta<NetworkOption>
  ) => {
    if (option) {
      setSelectedNetwork(option);
      onNetworkSwitch(option.value);
    }
  };

  return (
    <NavBarWrapper>
      <NavLinks>
        <NavLink to="/" $isActive={location.pathname === "/"}>
          Vaults
        </NavLink>
        <NavLink
          to="/out-of-bounds-markets"
          $isActive={location.pathname === "/out-of-bounds-markets"}
        >
          Out of Range Markets
        </NavLink>
        <NavLink
          to="/market-warnings"
          $isActive={location.pathname === "/market-warnings"}
        >
          Markets With Warnings
        </NavLink>
        <NavLink
          to="/markets-without-strategy"
          $isActive={location.pathname === "/markets-without-strategy"}
        >
          Strategyless Markets
        </NavLink>
      </NavLinks>
      <NetworkSelect
        options={networkOptions}
        value={selectedNetwork}
        onChange={handleNetworkChange as any}
        styles={{
          control: (base) => ({
            ...base,
            fontSize: "0.8rem",
          }),
        }}
        placeholder="Select a network"
      />
    </NavBarWrapper>
  );
};

export default NavBar;

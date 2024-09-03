import React from "react";
import styled from "styled-components";
import Bubble from "./Bubble";
import { Link } from "react-router-dom";

const NavBarWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #15181a;
  padding: 10px 20px;
  color: white;
`;

const NavLinks = styled.div`
  display: flex;
  gap: 15px;
`;

const NavLink = styled(Link)`
  color: white;
  text-decoration: none;
  font-size: 1.2em;

  &:hover {
    text-decoration: underline;
  }
`;

const NetworkSwitchBubble = styled(Bubble)`
  margin-left: auto;
`;

type NavBarProps = {
  currentNetwork: "ethereum" | "base";
  onNetworkSwitch: () => void;
};

const NavBar: React.FC<NavBarProps> = ({ currentNetwork, onNetworkSwitch }) => {
  return (
    <NavBarWrapper>
      <NavLinks>
        <NavLink to="/">Vaults</NavLink>
        <NavLink to="/out-of-bounds-markets">Out of Range Markets</NavLink>
      </NavLinks>
      <NetworkSwitchBubble onClick={onNetworkSwitch} backgroundColor="#878787">
        Switch to {currentNetwork === "ethereum" ? "Base" : "Ethereum"}
      </NetworkSwitchBubble>
    </NavBarWrapper>
  );
};

export default NavBar;

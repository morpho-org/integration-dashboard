import React from "react";
import styled from "styled-components";
import Bubble from "./Bubble";

const NavBarWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--ifm-color-dark-800);
  padding: 10px 20px;
  color: white;
`;

const NavLinks = styled.div`
  display: flex;
  gap: 15px;
`;

const NavLink = styled.a`
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
        <NavLink href="#">Flow Caps</NavLink>
        {/* Add more NavLink components as needed */}
      </NavLinks>
      <NetworkSwitchBubble onClick={onNetworkSwitch}>
        Switch to {currentNetwork === "ethereum" ? "Base" : "Ethereum"}
      </NetworkSwitchBubble>
    </NavBarWrapper>
  );
};

export default NavBar;

import React from "react";
import styled from "styled-components";
import Bubble from "./Bubble";
import MarketFlowCapsBubble from "./MarketFlowCapsBubble";
import { VaultMissingFlowCaps } from "../utils/types";

type VaultFlowCapsBubbleProps = {
  vault: VaultMissingFlowCaps;
  expanded: boolean;
  onClick?: () => void;
};

const StyledBubble = styled(Bubble)<{ expanded: boolean }>`
  flex: ${({ expanded }) => (expanded ? "1 1 100%" : "0 1 auto")};
  margin: 5px;
  width: ${({ expanded }) => (expanded ? "100%" : "auto")};
  height: ${({ expanded }) => (expanded ? "300px" : "auto")};
  display: flex;
  flex-direction: column;
`;

const MarketContainer = styled.div`
  margin-left: 20px;
  margin-top: 10px;
  flex-grow: 1;
`;

const VaultFlowCapsBubble: React.FC<VaultFlowCapsBubbleProps> = ({
  vault,
  expanded,
  onClick,
}) => {
  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onClick) onClick();
  };

  return (
    <StyledBubble
      expanded={expanded}
      onClick={handleClick}
      backgroundColor={"black"}
    >
      <h3 style={{ color: vault.warnings.missingFlowCaps ? "red" : "white" }}>
        <a href={vault.vault.link} target="_blank" rel="noopener noreferrer">
          {vault.vault.name}
        </a>
      </h3>
      {expanded && (
        <MarketContainer>
          {vault.markets.map((market) => (
            <MarketFlowCapsBubble key={market.id} market={market} />
          ))}
        </MarketContainer>
      )}
    </StyledBubble>
  );
};

export default VaultFlowCapsBubble;

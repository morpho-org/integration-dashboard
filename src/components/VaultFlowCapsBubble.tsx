import React from "react";
import styled from "styled-components";
import Bubble from "./Bubble";
import MarketFlowCapsBubble from "./MarketFlowCapsBubble";
import { VaultData } from "../utils/types";

type VaultFlowCapsBubbleProps = {
  vault: VaultData;
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

const TitleWrapper = styled.div<{ isWarning: boolean }>`
  display: inline-block;
  padding: 2px 6px;
  background-color: ${({ isWarning }) =>
    isWarning ? "#7f1d1d" : "transparent"};
  border-radius: 4px;
  width: 100%;
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

  const missingFlowCaps = vault.warnings.missingFlowCaps ?? false;

  return (
    <StyledBubble
      expanded={expanded}
      onClick={handleClick}
      backgroundColor={"#6B7280"}
    >
      <TitleWrapper isWarning={missingFlowCaps}>
        <h3 style={{ color: "white", margin: 0 }}>{"Flow Caps"}</h3>
      </TitleWrapper>
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

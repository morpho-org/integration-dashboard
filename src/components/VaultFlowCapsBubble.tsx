import React, { useState } from "react";
import styled from "styled-components";
import Bubble from "./Bubble";
import MarketFlowCapsBubble from "./MarketFlowCapsBubble";
import { VaultMissingFlowCaps } from "../utils/types";

const MarketContainer = styled.div`
  margin-left: 20px;
  margin-top: 10px;
`;

type VaultFlowCapsBubbleProps = {
  vault: VaultMissingFlowCaps;
};

const VaultFlowCapsBubble: React.FC<VaultFlowCapsBubbleProps> = ({ vault }) => {
  const [expanded, setExpanded] = useState(false);

  const backgroundColor = "black";

  const titleColor = vault.noMissingFlowCaps
    ? "white"
    : vault.allFlowCapsMissing
    ? "#red"
    : "#orange";

  return (
    <div>
      <Bubble
        onClick={() => setExpanded(!expanded)}
        backgroundColor={backgroundColor}
      >
        <h3 style={{ color: titleColor }}>
          {" "}
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
      </Bubble>
    </div>
  );
};

export default VaultFlowCapsBubble;

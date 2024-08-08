import React, { useState } from "react";
import styled from "styled-components";
import Bubble from "./Bubble";
import MarketBubble from "./MarketBubble";
import { VaultMissingFlowCaps } from "../utils/types";

const MarketContainer = styled.div`
  margin-left: 20px;
  margin-top: 10px;
`;

type VaultBubbleProps = {
  vault: VaultMissingFlowCaps;
};

const VaultBubble: React.FC<VaultBubbleProps> = ({ vault }) => {
  const [expanded, setExpanded] = useState(false);

  const noMissingFlowCaps = vault.markets.every((market) => !market.missing);
  const allFlowCapsMissing = vault.markets.every((market) => market.missing);

  const backgroundColor = noMissingFlowCaps
    ? "#2470ff"
    : allFlowCapsMissing
    ? "orange"
    : "yellow";

  return (
    <div>
      <Bubble
        onClick={() => setExpanded(!expanded)}
        backgroundColor={backgroundColor}
      >
        <h3>
          {" "}
          <a href={vault.vault.link} target="_blank" rel="noopener noreferrer">
            {vault.vault.name}
          </a>
        </h3>
        {expanded && (
          <MarketContainer>
            {vault.markets.map((market) => (
              <MarketBubble key={market.id} market={market} />
            ))}
          </MarketContainer>
        )}
      </Bubble>
    </div>
  );
};

export default VaultBubble;

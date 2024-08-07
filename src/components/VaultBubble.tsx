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

  return (
    <div>
      <Bubble onClick={() => setExpanded(!expanded)}>
        <h3>
          {" "}
          <a href={vault.vault.link} target="_blank" rel="noopener noreferrer">
            {vault.vault.name}
          </a>
        </h3>
        {expanded && (
          <MarketContainer>
            {vault.marketsWithMissingFlowCaps.map((market) => (
              <MarketBubble key={market.id} market={market} />
            ))}
          </MarketContainer>
        )}
      </Bubble>
    </div>
  );
};

export default VaultBubble;

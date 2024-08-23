import React, { useState } from "react";
import styled from "styled-components";
import Bubble from "./Bubble";
import MarketReallocationDataBubble from "./MarketReallocationDataBubble";
import { VaultReallocationData } from "../utils/types";

const MarketContainer = styled.div`
  margin-left: 20px;
  margin-top: 10px;
`;

type VaultBubbleProps = {
  vault: VaultReallocationData;
};

const VaultReallocationDataBubble: React.FC<VaultBubbleProps> = ({ vault }) => {
  const [expanded, setExpanded] = useState(false);

  const backgroundColor = vault.reallocation ? "#2470ff" : "#4B0082";

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div>
      <Bubble onClick={handleClick} backgroundColor={backgroundColor}>
        <h3>
          {" "}
          <a href={vault.vault.link} target="_blank" rel="noopener noreferrer">
            {vault.vault.name}
          </a>
        </h3>

        {expanded && (
          <MarketContainer>
            {vault.marketReallocationData.map((market) => (
              <MarketReallocationDataBubble
                key={market.id}
                market={market}
                vault={vault.vault}
              />
            ))}
          </MarketContainer>
        )}
      </Bubble>
    </div>
  );
};

export default VaultReallocationDataBubble;

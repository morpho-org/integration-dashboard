import React, { useState } from "react";
import styled from "styled-components";
import Bubble from "./Bubble";
import MarketReallocationDataBubble from "./MarketReallocationDataBubble";
import { VaultReallocationData } from "../utils/types";
import { formatAllocation } from "../utils/stringFormatter";
import TransactionSender from "./TransactionSender";

const MarketContainer = styled.div`
  margin-left: 20px;
  margin-top: 10px;
`;

type VaultBubbleProps = {
  vault: VaultReallocationData;
  networkId: number;
};

const VaultReallocationDataBubble: React.FC<VaultBubbleProps> = ({
  vault,
  networkId,
}) => {
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

        {expanded && vault.reallocation && (
          <div style={{ color: "white" }}>
            {[
              "Proposed reallocation:",
              ...vault.reallocation.logData
                .map((logData) =>
                  formatAllocation(logData, vault.vault.underlyingAsset)
                )
                .flat(),
            ].map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
        )}

        {expanded && vault.reallocation && (
          <div style={{ color: "white" }}>
            <TransactionSender
              networkId={networkId}
              vaultAddress={vault.vault.address}
              withdrawals={vault.reallocation.withdrawals}
              supplyMarketParams={vault.reallocation.supplyMarketParams}
            />
          </div>
        )}

        {expanded && !vault.reallocation && (
          <div style={{ color: "white" }}>
            <p>No meaningful reallocation</p>
          </div>
        )}

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

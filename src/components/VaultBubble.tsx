import React, { useState } from "react";
import styled from "styled-components";
import Bubble from "./Bubble";
import { VaultMissingFlowCaps } from "../utils/types";
import WithdrawQueueBubble from "./WithdrawQueueBubble";
import SupplyQueueBubble from "./SupplyQueueBubble";
import VaultFlowCapsBubble from "./VaultFlowCapsBubble";

const BubbleContainer = styled.div<{ isExpanded: boolean }>`
  display: flex;
  justify-content: space-between; /* Aligner les bulles sur une ligne */
  align-items: flex-start;
  margin-top: 10px;
  width: 100%;
`;

const VaultBubbleContainer = styled.div`
  margin-bottom: 20px;
`;

type VaultBubbleProps = {
  vault: VaultMissingFlowCaps;
};

const VaultBubble: React.FC<VaultBubbleProps> = ({ vault }) => {
  const [expanded, setExpanded] = useState(false);
  const [activeBubble, setActiveBubble] = useState<string | null>(null);

  const backgroundColor =
    vault.warnings.idlePositionWithdrawQueue ||
    vault.warnings.idlePositionSupplyQueue ||
    vault.warnings.missingFlowCaps
      ? "#7D1B7E"
      : "#2470ff";

  const handleBubbleClick = (bubbleName: string) => {
    setActiveBubble((prev) => (prev === bubbleName ? null : bubbleName));
  };

  return (
    <VaultBubbleContainer>
      <Bubble
        onClick={() => setExpanded(!expanded)}
        backgroundColor={backgroundColor}
      >
        <h3>
          <a href={vault.vault.link} target="_blank" rel="noopener noreferrer">
            {vault.vault.name}
          </a>
        </h3>
        {expanded && (
          <BubbleContainer isExpanded={!!activeBubble}>
            <WithdrawQueueBubble
              expanded={activeBubble === "WithdrawQueue"}
              onClick={() => handleBubbleClick("WithdrawQueue")}
              withdrawQueue={vault.withdrawQueue}
              warnings={vault.warnings}
            />
            <SupplyQueueBubble
              expanded={activeBubble === "SupplyQueue"}
              onClick={() => handleBubbleClick("SupplyQueue")}
              supplyQueue={vault.supplyQueue}
              warnings={vault.warnings}
            />
            <VaultFlowCapsBubble
              expanded={activeBubble === "FlowCaps"}
              onClick={() => handleBubbleClick("FlowCaps")}
              vault={vault}
            />
          </BubbleContainer>
        )}
      </Bubble>
    </VaultBubbleContainer>
  );
};

export default VaultBubble;

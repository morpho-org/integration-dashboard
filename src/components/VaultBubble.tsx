import React, { useState } from "react";
import styled from "styled-components";
import Bubble from "./Bubble";
import { VaultData } from "../utils/types";
import WithdrawQueueBubble from "./WithdrawQueueBubble";
import SupplyQueueBubble from "./SupplyQueueBubble";
import VaultFlowCapsBubble from "./VaultFlowCapsBubble";
import { handleLinkClick } from "../utils/utils";

const BubbleContainer = styled.div<{ isExpanded: boolean }>`
  display: flex;
  justify-content: space-evenly;
  align-items: flex-start;
  margin-top: 10px;
  width: 100%;
`;

type VaultBubbleProps = {
  vault: VaultData;
};

const VaultBubble: React.FC<VaultBubbleProps> = ({ vault }) => {
  const [expanded, setExpanded] = useState(false);
  const [activeBubble, setActiveBubble] = useState<string | null>(null);

  const warning =
    vault.warnings &&
    (vault.warnings.idlePositionWithdrawQueue ||
      vault.warnings.idlePositionSupplyQueue ||
      vault.warnings.missingFlowCaps);

  const handleBubbleClick = (bubbleName: string) => {
    setActiveBubble((prev) => (prev === bubbleName ? null : bubbleName));
  };

  return (
    <Bubble
      onClick={() => setExpanded(!expanded)}
      backgroundColor={warning ? "#ff6961" : "#2C2F33"}
    >
      <h3>
        <a
          style={{
            color: "white",
          }}
          href={vault.vault.link.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleLinkClick}
        >
          {vault.vault.link.name}
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
  );
};

export default VaultBubble;

import React, { useState } from "react";
import styled from "styled-components";
import Bubble from "./Bubble";
import { VaultWithBlockingFlowCaps } from "../utils/types";
import { handleLinkClick } from "../utils/utils";
import BlockingFlowCapsBubble from "./BlockingFlowCapsBubble";

const MarketContainer = styled.div`
  margin-left: 20px;
  margin-top: 10px;
`;

const VaultWithBlockingFlowCapsBubbleContainer = styled.div`
  margin-bottom: 20px;
`;

type VaultWithBlockingFlowCapsBubbleProps = {
  vaultWithBlockingFlowCaps: VaultWithBlockingFlowCaps;
};

const VaultWithBlockingFlowCapsBubble: React.FC<
  VaultWithBlockingFlowCapsBubbleProps
> = ({ vaultWithBlockingFlowCaps }) => {
  const [expanded, setExpanded] = useState(false);

  const vault = vaultWithBlockingFlowCaps.vault;

  return (
    <VaultWithBlockingFlowCapsBubbleContainer>
      <Bubble onClick={() => setExpanded(!expanded)} backgroundColor={"black"}>
        <h3>
          <a
            style={{
              color: "white",
            }}
            href={vault.link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleLinkClick}
          >
            {vault.link.name}
          </a>
        </h3>
        {expanded && (
          <MarketContainer>
            {vaultWithBlockingFlowCaps.blockingFlowCaps.map((item) => (
              <BlockingFlowCapsBubble blockingFlowCaps={item} />
            ))}
          </MarketContainer>
        )}
      </Bubble>
    </VaultWithBlockingFlowCapsBubbleContainer>
  );
};

export default VaultWithBlockingFlowCapsBubble;

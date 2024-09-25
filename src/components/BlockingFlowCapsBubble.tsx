import React, { useState } from "react";
import styled from "styled-components";
import Bubble from "./Bubble";
import { BlockingFlowCaps } from "../utils/types";
import { handleLinkClick } from "../utils/utils";
import { LinkItem, LinkList } from "../pages/wrappers";

const MarketContainer = styled.div`
  margin-left: 20px;
  margin-top: 10px;
  color: black;
`;

type BlockingFlowCapsBubbleProps = {
  blockingFlowCaps: BlockingFlowCaps;
};

const BlockingFlowCapsBubble: React.FC<BlockingFlowCapsBubbleProps> = ({
  blockingFlowCaps,
}) => {
  const [expanded, setExpanded] = useState(false);

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setExpanded(!expanded);
  };

  const backgroundColor = "#f0f0f0";

  return (
    <div>
      <Bubble onClick={handleClick} backgroundColor={backgroundColor}>
        <h3 style={{ color: "#0F0000" }}>
          <a
            style={{ color: "#0F0000" }}
            href={blockingFlowCaps.market.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleLinkClick}
          >
            {blockingFlowCaps.market.name}
          </a>
        </h3>
        {expanded && (
          <MarketContainer>
            <p>
              Blocking Flow Caps: {formatBlockingFlowCaps(blockingFlowCaps)}
            </p>
            <LinkList>
              {blockingFlowCaps.blockedMarkets.map((blockedMarket, index) => (
                <LinkItem key={index}>
                  <a
                    style={{
                      color: "whitek",
                    }}
                    href={blockedMarket.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleLinkClick}
                  >
                    {blockedMarket.name}
                  </a>
                </LinkItem>
              ))}
            </LinkList>
          </MarketContainer>
        )}
      </Bubble>
    </div>
  );
};

const formatBlockingFlowCaps = (blockingFlowCaps: BlockingFlowCaps) => {
  if (blockingFlowCaps.maxIn && !blockingFlowCaps.maxOut) return "Max In";
  else if (!blockingFlowCaps.maxIn && blockingFlowCaps.maxOut) return "Max Out";
  else return "Max In and Max Out";
};

export default BlockingFlowCapsBubble;

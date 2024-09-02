import React, { useState } from "react";
import styled from "styled-components";
import Bubble from "./Bubble";
import { Queue, VaultWarnings } from "../utils/types";

type SupplyQueueBubbleProps = {
  supplyQueue: Queue;
  warnings?: VaultWarnings;
};

const LinkList = styled.ol`
  margin-top: 10px;
  padding-left: 20px;
`;

const LinkItem = styled.li`
  margin-bottom: 5px;

  a {
    color: white;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;

const SupplyQueueBubble: React.FC<SupplyQueueBubbleProps> = ({
  supplyQueue,
  warnings,
}) => {
  const [expanded, setExpanded] = useState(false);

  const wrongIdlePosition = warnings && warnings.idlePositionSupplyQueue;

  return (
    <Bubble onClick={() => setExpanded(!expanded)} backgroundColor={"black"}>
      <h3
        style={{
          color: wrongIdlePosition ? "red" : "white",
        }}
      >
        {"Supply Queue"}
      </h3>
      {expanded && (
        <>
          <LinkList>
            {supplyQueue.map((market, index) => (
              <LinkItem key={index}>
                <a href={market.link} target="_blank" rel="noopener noreferrer">
                  {index + 1}. {market.name}
                </a>
              </LinkItem>
            ))}
          </LinkList>
          {wrongIdlePosition && (
            <p style={{ color: "red" }}>
              Idle market is not the last element of the list.
            </p>
          )}
        </>
      )}
    </Bubble>
  );
};

export default SupplyQueueBubble;

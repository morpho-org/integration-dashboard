import React from "react";
import styled from "styled-components";
import Bubble from "./Bubble";
import { Queue, VaultWarnings } from "../utils/types";
import { handleLinkClick } from "../utils/utils";

type SupplyQueueBubbleProps = {
  supplyQueue: Queue;
  warnings?: VaultWarnings;
  expanded: boolean;
  onClick?: () => void;
};

const StyledBubble = styled(Bubble)<{ expanded: boolean }>`
  flex: ${({ expanded }) => (expanded ? "1 1 100%" : "0 1 auto")};
  margin: 5px;
  width: ${({ expanded }) => (expanded ? "100%" : "auto")};
  height: ${({ expanded }) => (expanded ? "300px" : "auto")};
  display: flex;
  flex-direction: column;
`;

const LinkList = styled.ol`
  margin-top: 10px;
  padding-left: 20px;
  flex-grow: 1;
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

const WarningMessage = styled.p`
  color: red;
  margin-top: 10px;
  flex-shrink: 0;
`;

const SupplyQueueBubble: React.FC<SupplyQueueBubbleProps> = ({
  supplyQueue,
  warnings,
  expanded,
  onClick,
}) => {
  const wrongIdlePosition = warnings && warnings.idlePositionSupplyQueue;

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onClick) onClick();
  };

  return (
    <StyledBubble
      expanded={expanded}
      onClick={handleClick}
      backgroundColor={"black"}
    >
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
                <a
                  href={market.link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleLinkClick}
                >
                  {index + 1}. {market.link.name}
                </a>
              </LinkItem>
            ))}
          </LinkList>
          {wrongIdlePosition && (
            <WarningMessage>
              Idle market is not the last element of the list.
            </WarningMessage>
          )}
        </>
      )}
    </StyledBubble>
  );
};

export default SupplyQueueBubble;

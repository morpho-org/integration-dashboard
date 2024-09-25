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

const WarningMessage = styled.div`
  display: inline-block;
  padding: 2px 6px;
  background-color: "#7f1d1d";
  border-radius: 4px;
`;

const TitleWrapper = styled.div<{ isWarning: boolean }>`
  display: inline-block;
  padding: 2px 6px;
  background-color: ${({ isWarning }) =>
    isWarning ? "#7f1d1d" : "transparent"};
  border-radius: 4px;
  width: 100%;
`;

const SupplyQueueBubble: React.FC<SupplyQueueBubbleProps> = ({
  supplyQueue,
  warnings,
  expanded,
  onClick,
}) => {
  const wrongIdlePosition = warnings?.idlePositionSupplyQueue ?? false;

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onClick) onClick();
  };

  return (
    <StyledBubble
      expanded={expanded}
      onClick={handleClick}
      backgroundColor={"#6B7280"}
    >
      <TitleWrapper isWarning={wrongIdlePosition}>
        <h3 style={{ color: "white", margin: 0 }}>{"Supply Queue"}</h3>
      </TitleWrapper>
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
              <div
                style={{
                  color: "white",
                  backgroundColor: "#7f1d1d",
                  padding: "2px 6px",
                  borderRadius: "4px",
                }}
              >
                Idle market is not the last element of the list.
              </div>
            </WarningMessage>
          )}
        </>
      )}
    </StyledBubble>
  );
};

export default SupplyQueueBubble;

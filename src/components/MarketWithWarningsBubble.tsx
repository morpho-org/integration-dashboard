import React from "react";
import Bubble from "./Bubble";
import { MarketWithWarning } from "../utils/types";
import styled from "styled-components";

type MarketWithWarningProps = {
  market: MarketWithWarning;
};

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

const MarketWithWarningBubble: React.FC<MarketWithWarningProps> = ({
  market,
}) => {
  const titleCollor = market.red ? "#FF0000" : "#D38F0C";
  return (
    <Bubble backgroundColor={"#f0f0f0"}>
      <p>
        <a
          href={market.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: titleCollor, marginLeft: "10px" }}
        >
          {market.name}
        </a>
      </p>
      <LinkList>
        {market.warnings.map((warning, index) => (
          <LinkItem key={index}>
            <p
              style={{ color: warning.level === "RED" ? "#FF0000" : "#D38F0C" }}
            >
              {" "}
              {warning.type}{" "}
            </p>
          </LinkItem>
        ))}
      </LinkList>
    </Bubble>
  );
};

export default MarketWithWarningBubble;

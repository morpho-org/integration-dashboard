import React from "react";
import Bubble from "./Bubble";
import { MarketWithWarning } from "../utils/types";
import { LinkItem, LinkList } from "../pages/wrappers";
import { handleLinkClick } from "../utils/utils";

type MarketWithWarningProps = {
  market: MarketWithWarning;
};

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
          onClick={handleLinkClick}
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

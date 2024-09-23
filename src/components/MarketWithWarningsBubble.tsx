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
  const titleColor = market.warnings.some((w) => w.level === "RED")
    ? "#FF0000"
    : "#D38F0C";
  return (
    <Bubble backgroundColor={"#f0f0f0"}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <p>
            <a
              href={market.link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: titleColor, marginLeft: "10px" }}
              onClick={handleLinkClick}
            >
              {market.link.name}
            </a>
          </p>
          <LinkList>
            {market.warnings.map((warning, index) => (
              <LinkItem key={index}>
                <p
                  style={{
                    color: warning.level === "RED" ? "#FF0000" : "#D38F0C",
                  }}
                >
                  {warning.type}
                </p>
              </LinkItem>
            ))}
          </LinkList>
        </div>
        <div style={{ textAlign: "right" }}>
          <p>Supply: {market.supplyAmount}</p>
          <p>Borrow: {market.borrowAmount}</p>
          <p>Collateral: {market.collateralAmount}</p>
        </div>
      </div>
    </Bubble>
  );
};

export default MarketWithWarningBubble;

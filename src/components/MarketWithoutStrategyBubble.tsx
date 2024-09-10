import React from "react";
import Bubble from "./Bubble";
import { MarketWithoutStrategy } from "../utils/types";

type MarketWithoutStrategyProps = {
  market: MarketWithoutStrategy;
};

const MarketWithoutStrategyBubble: React.FC<MarketWithoutStrategyProps> = ({
  market,
}) => {
  const titleCollor = "black";
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
    </Bubble>
  );
};

export default MarketWithoutStrategyBubble;

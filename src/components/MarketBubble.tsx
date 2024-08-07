import React from "react";
import Bubble from "./Bubble";
import { MarketMissingFlowCaps } from "../utils/types";

type MarketBubbleProps = {
  market: MarketMissingFlowCaps;
};

const MarketBubble: React.FC<MarketBubbleProps> = ({ market }) => {
  return (
    <Bubble backgroundColor="#d3e0ea">
      <p>
        <a href={market.link} target="_blank" rel="noopener noreferrer">
          {market.name}
        </a>
      </p>
      <p>Max In USD: {market.maxInUsd ?? "OK"}</p>
      <p>Max Out USD: {market.maxOutUsd ?? "OK"}</p>
    </Bubble>
  );
};

export default MarketBubble;

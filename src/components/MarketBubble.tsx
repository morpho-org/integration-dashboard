import React from "react";
import Bubble from "./Bubble";
import { MarketFlowCaps } from "../utils/types";

type MarketBubbleProps = {
  market: MarketFlowCaps;
};

const MarketBubble: React.FC<MarketBubbleProps> = ({ market }) => {
  const backgroundColor = market.missing ? "red" : "#5782ff";
  return (
    <Bubble backgroundColor={backgroundColor}>
      <p>
        <a href={market.link} target="_blank" rel="noopener noreferrer">
          {market.name}
        </a>
      </p>
      <p>Max In: {market.maxInUsd ?? "OK"}</p>
      <p>Max Out: {market.maxOutUsd ?? "OK"}</p>
    </Bubble>
  );
};

export default MarketBubble;

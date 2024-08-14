import React from "react";
import Bubble from "./Bubble";
import { MarketFlowCaps } from "../utils/types";

type MarketFlowCapsBubbleProps = {
  market: MarketFlowCaps;
};

const MarketFlowCapsBubble: React.FC<MarketFlowCapsBubbleProps> = ({
  market,
}) => {
  const backgroundColor = market.missing ? "red" : "#5782ff";
  return (
    <Bubble backgroundColor={backgroundColor}>
      <p>
        <a href={market.link} target="_blank" rel="noopener noreferrer">
          {market.name}
        </a>
      </p>
      <p>Max Out: {market.maxOutUsd}</p>
      <p>Max In: {market.maxInUsd}</p>
      <p>
        Supply Assets: {market.supplyAssetsFormatted} (
        {market.supplyAssetsUsdFormatted})
      </p>
      <p>Supply Cap: {market.supplyCapUsd}</p>
    </Bubble>
  );
};

export default MarketFlowCapsBubble;

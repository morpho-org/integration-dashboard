import React from "react";
import Bubble from "./Bubble";
import { MarketFlowCaps } from "../utils/types";
import { handleLinkClick } from "../utils/utils";

type MarketFlowCapsBubbleProps = {
  market: MarketFlowCaps;
};

const MarketFlowCapsBubble: React.FC<MarketFlowCapsBubbleProps> = ({
  market,
}) => {
  const backgroundColor = market.missing ? "#7f1d1d" : "#5782ff";
  return (
    <Bubble backgroundColor={backgroundColor}>
      <p>
        <a
          href={market.link.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleLinkClick}
        >
          {market.link.name}
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

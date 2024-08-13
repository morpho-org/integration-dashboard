import React, { useState } from "react";
import styled from "styled-components";
import Bubble from "./Bubble";
import { OutOfBoundsMarket } from "../utils/types";
import { formatWAD } from "../utils/utils";

const MarketContainer = styled.div`
  margin-left: 20px;
  margin-top: 10px;
`;

type OutOfBoundsMarketBubbleProps = {
  market: OutOfBoundsMarket;
};

const OutOfBoundsMarketBubble: React.FC<OutOfBoundsMarketBubbleProps> = ({
  market,
}) => {
  const [expanded, setExpanded] = useState(false);
  const backgroundColor = "#2470ff";
  console.log(market.target);
  const target =
    "apyTarget" in market.target
      ? `APY target range: [${formatWAD(
          market.target.apyRange.lowerBound
        )}, ${formatWAD(
          market.target.apyRange.upperBound
        )}], (borrow APY target: ${formatWAD(market.target.apyTarget)})`
      : `utilization target range: [${formatWAD(
          market.target.utilizationRange.lowerBound
        )}, ${formatWAD(
          market.target.utilizationRange.upperBound
        )}], (borrow APY target: ${formatWAD(
          market.target.utilizationTarget
        )})`;
  return (
    <div>
      <Bubble
        onClick={() => setExpanded(!expanded)}
        backgroundColor={backgroundColor}
      >
        <h3>
          {" "}
          <a href={market.link} target="_blank" rel="noopener noreferrer">
            {market.name}
          </a>
        </h3>
        {expanded && (
          <MarketContainer>
            <p>
              Supply APY: {formatWAD(market.apys.supplyApy)}, Borrow APY:{" "}
              {formatWAD(market.apys.borrowApy)}
            </p>
            <p>Utilization: {formatWAD(market.utilization)}</p>
            <p>{target}</p>
          </MarketContainer>
        )}
      </Bubble>
    </div>
  );
};

export default OutOfBoundsMarketBubble;

import React from "react";
import { MarketWithoutStrategy } from "../utils/types";
import styled from "styled-components";

type MarketWithoutStrategyProps = {
  market: MarketWithoutStrategy;
};

const Bubble = styled.div`
  background-color: #f0f0f0;
  border-radius: 10px;
  padding: 10px;
  width: 100%;
  height: auto;
  display: flex;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
`;

const StyledLink = styled.a`
  display: block;
  text-align: center;
  overflow: hidden;
  word-wrap: break-word;
  white-space: normal;
  width: 100%;
  padding: 10px;
  color: black;
  text-decoration: none;
`;

const MarketWithoutStrategyBubble: React.FC<MarketWithoutStrategyProps> = ({
  market,
}) => {
  return (
    <Bubble>
      <p>
        <StyledLink
          href={market.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "black" }}
        >
          {market.name}
        </StyledLink>
      </p>
    </Bubble>
  );
};

export default MarketWithoutStrategyBubble;

import React from "react";
import { MarketWithoutStrategy } from "../utils/types";
import styled from "styled-components";
import { Copy } from "lucide-react";

type MarketWithoutStrategyProps = {
  market: MarketWithoutStrategy;
};

const Bubble = styled.div`
  background-color: #2c2f33;
  border-radius: 10px;
  padding: 10px;
  width: 100%;
  height: auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-sizing: border-box;
`;

const MarketName = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`;

const CopyIcon = styled(Copy)`
  color: #ffffff; // Change color to white for visibility
  cursor: pointer;
  transition: color 0.3s ease;
  margin-left: 10px; // Add some space between the text and icon

  &:hover {
    color: #cccccc; // Change color on hover for better UX
  }
`;

const StyledLink = styled.a`
  text-align: right;
  overflow: hidden;
  word-wrap: break-word;
  white-space: normal;
  color: white;
  text-decoration: none;
`;

const MarketWithoutStrategyBubble: React.FC<MarketWithoutStrategyProps> = ({
  market,
}) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(market.id);
  };

  return (
    <Bubble>
      <MarketName>
        <StyledLink
          href={market.link.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {market.link.name}
        </StyledLink>
        <CopyIcon size={16} onClick={handleCopy} />
      </MarketName>
    </Bubble>
  );
};

export default MarketWithoutStrategyBubble;

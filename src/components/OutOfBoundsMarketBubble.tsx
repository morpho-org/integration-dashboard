import React, { useState } from "react";
import styled from "styled-components";
import Bubble from "./Bubble";
import VaultReallocationDataBubble from "./VaultReallocationDataBubble";
import {
  ApyTarget,
  OutOfBoundsMarket,
  UtilizationTarget,
  VaultReallocationData,
} from "../utils/types";
import {
  formatTokenAmount,
  formatUsdAmount,
  formatWAD,
  handleLinkClick,
} from "../utils/utils";
import { lookForReallocations } from "../core/lookForReallocations";

const StyledButton = styled.button`
  background-color: #007bff;
  color: white;
  border: none;
  padding: 10px 20px;
  cursor: pointer;
  border-radius: 5px;
  display: block;
  margin: 0 auto;
`;

const MarketContainer = styled.div`
  margin-left: 20px;
  margin-top: 10px;
  color: white;
`;

const BubbleContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 60px;
`;

const LeftColumn = styled.div`
  flex: 1;
  text-align: left;
  color: white;
  width: 200px;
`;

const MiddleColumn = styled.div`
  flex: 1;
  text-align: left;
  color: white;
`;

const Middle2Column = styled.div`
  flex: 1;
  text-align: left;
  color: white;
  font-weight: bold;
`;

const RightColumn = styled.div`
  flex: 1;
  text-align: right;
  color: white;
  font-weight: bold;
`;

const MarketLink = styled.a`
  color: white;
  text-decoration: none;
  font-weight: bold;
`;

type OutOfBoundsMarketBubbleProps = {
  market: OutOfBoundsMarket;
  networkId: number;
};

const OutOfBoundsMarketBubble: React.FC<OutOfBoundsMarketBubbleProps> = ({
  market,
  networkId,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [vaults, setVaults] = useState<VaultReallocationData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reallocationsSearched, setReallocationsSearched] = useState(false);
  const [buttonVisible, setButtonVisible] = useState(true);

  const handleSearchReallocations = async (event: React.MouseEvent) => {
    event.stopPropagation();

    setLoading(true);
    setError(null);
    setButtonVisible(false);
    try {
      const fetchedVaults = await lookForReallocations(networkId, market);
      setVaults(fetchedVaults);
      setReallocationsSearched(true);
    } catch (err) {
      setError("Failed to fetch reallocations");
    } finally {
      setLoading(false);
    }
  };

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

  const distanceToTarget = distanceToTargetMessage(market.target);

  return (
    <div>
      <Bubble
        onClick={() => setExpanded(!expanded)}
        backgroundColor={distanceToTarget.color}
      >
        <BubbleContent>
          <LeftColumn>
            <h3>
              <MarketLink
                href={market.link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleLinkClick}
              >
                {market.link.name}
              </MarketLink>
            </h3>
          </LeftColumn>
          <MiddleColumn>{distanceToTarget.distanceMessage}</MiddleColumn>
          <Middle2Column>
            {formatUsdAmount(market.totalSupplyUsd)}
          </Middle2Column>
          <RightColumn> </RightColumn>
        </BubbleContent>
        {expanded && (
          <MarketContainer>
            <p>
              Supply APY: {formatWAD(market.marketChainData.apys.supplyApy)},
              Borrow APY: {formatWAD(market.marketChainData.apys.borrowApy)}
            </p>
            <p>Utilization: {formatWAD(market.utilization)}</p>
            <p>{target}</p>
            <p>{`${
              market.aboveRange ? "Supply" : "Withdraw"
            } ${formatTokenAmount(
              market.amountToReachTarget,
              market.loanAsset
            )} ${
              market.aboveRange ? "into" : "from"
            } the market to reach target.`}</p>

            {buttonVisible && (
              <StyledButton onClick={handleSearchReallocations}>
                Seek for reallocations
              </StyledButton>
            )}

            {loading && <p>Loading reallocations...</p>}

            {vaults && !loading && (
              <div>
                {formatMainReallocationMessage(vaults, market).map(
                  (line, index) => (
                    <p key={index}>{line}</p>
                  )
                )}
              </div>
            )}

            {error && <p style={{ color: "red" }}>{error}</p>}

            {reallocationsSearched && vaults && (
              <>
                {vaults.map((vault) => (
                  <VaultReallocationDataBubble
                    key={vault.vault.link.name}
                    vault={vault}
                    networkId={networkId}
                  />
                ))}
              </>
            )}
          </MarketContainer>
        )}
      </Bubble>
    </div>
  );
};

const formatMainReallocationMessage = (
  vaults: VaultReallocationData[],
  market: OutOfBoundsMarket
) => {
  const numberOfReallocations = vaults.filter(
    (item) => item.reallocation !== undefined
  ).length;

  if (numberOfReallocations === 0) return ["No reallocations found"];
  else {
    const bestReallocation = vaults.reduce((prev, current) => {
      if (!current.reallocation || !prev.reallocation) {
        return prev.reallocation ? prev : current;
      }
      return current.reallocation.amountReallocated >
        prev.reallocation.amountReallocated
        ? current
        : prev;
    });

    return [
      `${numberOfReallocations} reallocations found. Best one is with ${bestReallocation.vault.link.name}`,
      `amount reallocated: ${formatTokenAmount(
        bestReallocation.reallocation!.amountReallocated,
        market.loanAsset
      )}`,
      `new borrow APY: ${formatWAD(
        bestReallocation.reallocation!.newState.apys.borrowApy
      )}`,
      `new supply APY: ${formatWAD(
        bestReallocation.reallocation!.newState.apys.supplyApy
      )}`,
      `new utilization: ${formatWAD(
        bestReallocation.reallocation!.newState.utilization
      )}`,
    ];
  }
};

const distanceToTargetMessage = (target: ApyTarget | UtilizationTarget) => {
  const distanceToTarget = Number(target.distanceToTarget) / 1e16;
  let color = "";
  if (distanceToTarget < 10) color = "#D38F0C";
  else if (distanceToTarget < 20) color = "#FFB15A";
  else if (distanceToTarget < 50) color = "#F67828";
  else if (distanceToTarget < 100) color = "#FF6961";
  else color = "#8B0000";

  const distanceMessage = `${formatWAD(target.distanceToTarget)} ${
    target.upperBoundCrossed ? "above" : "below"
  } target`;
  return { color, distanceMessage };
};

export default OutOfBoundsMarketBubble;

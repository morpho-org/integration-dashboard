import React, { useState, useEffect } from "react";
import styled from "styled-components";
import Bubble from "./Bubble";
import VaultReallocationDataBubble from "./VaultReallocationDataBubble";
import { OutOfBoundsMarket, VaultReallocationData } from "../utils/types";
import { formatTokenAmount, formatWAD } from "../utils/utils";
import { lookForReallocations } from "../core/lookForReallocations";

const MarketContainer = styled.div`
  margin-left: 20px;
  margin-top: 10px;
  color: black;
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

  useEffect(() => {
    const fetchReallocations = async () => {
      if (expanded && !vaults) {
        setLoading(true);
        setError(null);
        try {
          const fetchedVaults = await lookForReallocations(networkId, market);
          setVaults(fetchedVaults);
        } catch (err) {
          setError("Failed to fetch reallocations");
        } finally {
          setLoading(false);
        }
      }
    };

    fetchReallocations();
  }, [expanded, networkId, market, vaults]);

  const backgroundColor = "#f0f0f0";
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
        <h3 style={{ color: "#0F0000" }}>
          <a
            style={{ color: "#0F0000" }}
            href={market.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            {market.name}
          </a>
        </h3>
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

            {loading && <p>Loading reallocations...</p>}

            {vaults && !loading && (
              <p>{formatMainReallocationMessage(vaults, market)}</p>
            )}

            {error && <p style={{ color: "red" }}>{error}</p>}

            {vaults && (
              <>
                {vaults.map((vault) => (
                  <VaultReallocationDataBubble
                    key={vault.vault.name}
                    vault={vault}
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

  if (numberOfReallocations === 0) return "No reallocations found";
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

    return `${numberOfReallocations} reallocations found. Best one is with ${
      bestReallocation.vault.name
    }: amount reallocated: ${formatTokenAmount(
      bestReallocation.reallocation!.amountReallocated,
      market.loanAsset
    )}, new borrow APY: ${formatWAD(
      bestReallocation.reallocation!.newState.apys.borrowApy
    )}, new supply APY: ${formatWAD(
      bestReallocation.reallocation!.newState.apys.supplyApy
    )}, new utilization: ${formatWAD(
      bestReallocation.reallocation!.newState.utilization
    )}`;
  }
};

export default OutOfBoundsMarketBubble;

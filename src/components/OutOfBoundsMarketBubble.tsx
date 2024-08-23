import React, { useState, useEffect } from "react";
import styled from "styled-components";
import Bubble from "./Bubble";
import VaultReallocationDataBubble from "./VaultReallocationDataBubble";
import { OutOfBoundsMarket, VaultReallocationData } from "../utils/types";
import { formatWAD } from "../utils/utils";
import { lookForReallocations } from "../core/lookForReallocations";

const MarketContainer = styled.div`
  margin-left: 20px;
  margin-top: 10px;
`;

type OutOfBoundsMarketBubbleProps = {
  market: OutOfBoundsMarket;
  networkId: number;
};

const OutOfBoundsMarketBubble: React.FC<OutOfBoundsMarketBubbleProps> = ({
  market,
  networkId,
}) => {
  const [expanded, setExpanded] = useState(false); // Pour savoir si la bulle est étendue
  const [vaults, setVaults] = useState<VaultReallocationData[] | null>(null); // Stocker les VaultReallocationData
  const [loading, setLoading] = useState(false); // Indicateur de chargement
  const [error, setError] = useState<string | null>(null); // Gérer les erreurs

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

  const backgroundColor = "#676767";
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
          <a href={market.link} target="_blank" rel="noopener noreferrer">
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

            {loading && <p>Loading reallocations...</p>}

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

export default OutOfBoundsMarketBubble;

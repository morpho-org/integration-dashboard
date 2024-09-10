import React, { useEffect, useState } from "react";
import { MarketWithoutStrategy } from "../utils/types";
import { getNetworkId } from "../utils/utils";
import {
  FilterInput,
  HeaderWrapper,
  MarketsWrapper,
  PageWrapper,
} from "./wrappers";
import { getMarketsWithoutStrategy } from "../core/marketsWithoutStrategy";
import MarketWithoutStrategyBubble from "../components/MarketWithoutStrategyBubble";

type MarketsWithoutStrategyPageProps = {
  network: "ethereum" | "base";
};

const MarketsWithoutStrategyPage: React.FC<MarketsWithoutStrategyPageProps> = ({
  network,
}) => {
  const [markets, setMarkets] = useState<MarketWithoutStrategy[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    const loadMarkets = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getMarketsWithoutStrategy(getNetworkId(network));
        setMarkets(data);
      } catch (err) {
        setError("Failed to fetch markets");
      } finally {
        setLoading(false);
      }
    };

    loadMarkets();
  }, [network]);

  const filteredMarkets = markets.filter(
    (market) =>
      market.loanAsset.symbol.toLowerCase().includes(filter.toLowerCase()) ||
      market.collateralAsset.symbol
        .toLowerCase()
        .includes(filter.toLowerCase()) ||
      market.id.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <PageWrapper>
      <HeaderWrapper>
        <h1 style={{ color: "black", fontWeight: "300" }}>
          Markets Without Strategy
        </h1>
        <FilterInput
          type="text"
          placeholder="Filter by asset symbol or market Id..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </HeaderWrapper>
      {loading && <p>Loading...</p>}
      {error && <p>{error}</p>}
      <MarketsWrapper>
        {filteredMarkets.map((market) => (
          <MarketWithoutStrategyBubble key={market.id} market={market} />
        ))}
      </MarketsWrapper>
    </PageWrapper>
  );
};

export default MarketsWithoutStrategyPage;

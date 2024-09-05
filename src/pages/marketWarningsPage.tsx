import React, { useEffect, useState } from "react";
import { MarketWithWarning } from "../utils/types";
import { getNetworkId } from "../utils/utils";
import {
  FilterInput,
  HeaderWrapper,
  MarketsWrapper,
  PageWrapper,
} from "./wrappers";
import { fetchMarketsWithWarnings } from "../fetchers/apiFetchers";
import MarketWithWarningBubble from "../components/MarketWithWarningsBubble";

type MarketWarningsPageProps = {
  network: "ethereum" | "base";
};

const MarketWarningsPage: React.FC<MarketWarningsPageProps> = ({ network }) => {
  const [markets, setMarkets] = useState<MarketWithWarning[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    const loadMarkets = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchMarketsWithWarnings(getNetworkId(network));
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
        <h1 style={{ color: "white" }}>Markets With Warnings</h1>
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
          <MarketWithWarningBubble key={market.id} market={market} />
        ))}
      </MarketsWrapper>
    </PageWrapper>
  );
};

export default MarketWarningsPage;

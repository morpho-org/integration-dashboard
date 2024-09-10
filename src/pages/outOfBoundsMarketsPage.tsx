import React, { useEffect, useState } from "react";
import OutOfBoundsMarketBubble from "../components/OutOfBoundsMarketBubble";
import { OutOfBoundsMarket } from "../utils/types";
import { getOutOfBoundsMarkets } from "../core/outOfBoundsMarkets";
import { getNetworkId } from "../utils/utils";
import {
  FilterContainer,
  FilterInput,
  HeaderWrapper,
  MarketsWrapper,
  PageWrapper,
  TitleContainer,
} from "./wrappers";

type OutOfBoundsMarketsPageProps = {
  network: "ethereum" | "base";
};

const OutOfBoundsMarketsPage: React.FC<OutOfBoundsMarketsPageProps> = ({
  network,
}) => {
  const [markets, setMarkets] = useState<OutOfBoundsMarket[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [supplyFilter, setSupplyFilter] = useState<number>(0);

  useEffect(() => {
    const loadMarkets = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getOutOfBoundsMarkets(getNetworkId(network));
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
      (market.loanAsset.symbol.toLowerCase().includes(filter.toLowerCase()) ||
        market.collateralAsset.symbol
          .toLowerCase()
          .includes(filter.toLowerCase()) ||
        market.id.toLowerCase().includes(filter.toLowerCase())) &&
      market.totalSupplyUsd >= supplyFilter
  );

  return (
    <PageWrapper>
      <HeaderWrapper>
        <TitleContainer>
          <h1 style={{ color: "black", fontWeight: "300" }}>
            Out of Range Markets
          </h1>
        </TitleContainer>
        <FilterContainer>
          <FilterInput
            type="text"
            placeholder="Filter by asset symbol or market Id..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select
            value={supplyFilter !== null ? supplyFilter : ""}
            onChange={(e) => setSupplyFilter(Number(e.target.value))}
            style={{ marginLeft: "20px", padding: "5px" }}
          >
            <option value="0">No Total Supply Threshold</option>
            <option value="1000">$1,000</option>
            <option value="10000">$10K</option>
            <option value="100000">$100K</option>
            <option value="1000000">$1M</option>
            <option value="10000000">$10M</option>
          </select>
        </FilterContainer>
      </HeaderWrapper>
      {loading && <p>Loading...</p>}
      {error && <p>{error}</p>}
      <MarketsWrapper>
        {filteredMarkets.map((market) => (
          <OutOfBoundsMarketBubble
            key={market.id}
            market={market}
            networkId={getNetworkId(network)}
          />
        ))}
      </MarketsWrapper>
    </PageWrapper>
  );
};

export default OutOfBoundsMarketsPage;

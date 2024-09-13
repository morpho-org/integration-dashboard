import React, { useEffect, useState } from "react";
import { MarketWithWarning } from "../utils/types";
import { getNetworkId } from "../utils/utils";
import {
  FilterInput,
  HeaderWrapper,
  MarketsWrapper,
  PageWrapper,
  Select,
} from "./wrappers";
import { fetchMarketsWithWarnings } from "../fetchers/apiFetchers";
import MarketWithWarningBubble from "../components/MarketWithWarningsBubble";
import { formatUsdAmount } from "../utils/utils";

type MarketWarningsPageProps = {
  network: "ethereum" | "base";
};

const MarketWarningsPage: React.FC<MarketWarningsPageProps> = ({ network }) => {
  const [markets, setMarkets] = useState<MarketWithWarning[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [colorFilter, setColorFilter] = useState<string>("all");

  useEffect(() => {
    const loadMarkets = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchMarketsWithWarnings(getNetworkId(network));
        setMarkets(data);
      } catch (err) {
        setError("Failed to fetch markets");
        console.log(err);
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
      (colorFilter === "all" ||
        (colorFilter === "red" &&
          market.warnings.some((w) => w.level === "RED")) ||
        (colorFilter === "yellow" &&
          market.warnings.some((w) => w.level === "YELLOW") &&
          !market.warnings.some((w) => w.level === "RED")))
  );

  const sortedMarkets = filteredMarkets.sort((a, b) => {
    const aHasRedWarning = a.warnings.some(
      (warning) => warning.level === "RED"
    );
    const bHasRedWarning = b.warnings.some(
      (warning) => warning.level === "RED"
    );
    const aHasYellowWarning = a.warnings.some(
      (warning) => warning.level === "YELLOW"
    );
    const bHasYellowWarning = b.warnings.some(
      (warning) => warning.level === "YELLOW"
    );

    if (aHasRedWarning && !bHasRedWarning) return -1;
    if (!aHasRedWarning && bHasRedWarning) return 1;
    if (aHasYellowWarning && !bHasYellowWarning) return -1;
    if (!aHasYellowWarning && bHasYellowWarning) return 1;

    return Number(b.supplyAmount) - Number(a.supplyAmount);
  });

  return (
    <PageWrapper>
      <HeaderWrapper>
        <h1 style={{ color: "black", fontWeight: "300" }}>
          Markets With Warnings
        </h1>
        <div style={{ display: "flex", gap: "10px" }}>
          <FilterInput
            type="text"
            placeholder="Filter by asset symbol or market Id..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <Select
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value)}
          >
            <option value="all">All Colors</option>
            <option value="red">Red Warnings</option>
            <option value="yellow">Yellow Warnings</option>
          </Select>
        </div>
      </HeaderWrapper>
      {loading && <p>Loading...</p>}
      {error && <p>{error}</p>}
      <MarketsWrapper>
        {sortedMarkets.map((market) => (
          <MarketWithWarningBubble
            key={market.id}
            market={{
              ...market,
              name: `${market.name}`,
              supplyAmount: formatUsdAmount(Number(market.supplyAmount)),
              borrowAmount: formatUsdAmount(Number(market.borrowAmount)),
              collateralAmount: formatUsdAmount(
                Number(market.collateralAmount)
              ),
            }}
          />
        ))}
      </MarketsWrapper>
    </PageWrapper>
  );
};

export default MarketWarningsPage;

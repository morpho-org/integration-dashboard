import React, { useEffect, useState } from "react";
import { MarketWithWarning } from "../utils/types";
import { getNetworkId } from "../utils/utils";
import { HeaderWrapper, MarketsWrapper, PageWrapper } from "./wrappers";
import { fetchMarketsWithWarnings } from "../fetchers/apiFetchers";
import MarketWithWarningBubble from "../components/MarketWithWarningsBubble";
import { formatUsdAmount } from "../utils/utils";
import styled from "styled-components";

const FilterButtons = styled.div`
  display: flex;
  align-items: center;
  background-color: #2c2f33;
  border-radius: 9999px;
  height: 40px;
`;

const FilterButton = styled.button<{ $isActive: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${(props) => (props.$isActive ? "#ffffff" : "#a0a0a0")};
  background-color: ${(props) => (props.$isActive ? "#2973FF" : "transparent")};
  border-radius: 9999px;
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  height: 100%;
  transition: all 0.3s;
  border: none;
  cursor: pointer;

  &:hover {
    background-color: ${(props) => (props.$isActive ? "#2973FF" : "#3a3f45")};
  }
`;

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
        <h1 style={{ color: "white", fontWeight: "300" }}>
          Markets With Warnings
        </h1>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by Market ID"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-[400px] h-[40px] py-2 px-4 pl-12 pr-4 rounded-full bg-opacity-10 bg-white text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                background: "rgba(250, 250, 250, 0.10)",
              }}
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="absolute left-3 top-1/2 transform -translate-y-1/2"
            >
              <path
                d="M17.3813 19.6187C17.723 19.9604 18.277 19.9604 18.6187 19.6187C18.9604 19.277 18.9604 18.723 18.6187 18.3813L17.3813 19.6187ZM13.3813 15.6187L17.3813 19.6187L18.6187 18.3813L14.6187 14.3813L13.3813 15.6187Z"
                fill="url(#paint0_linear_32_2985)"
              />
              <circle
                cx="10"
                cy="11"
                r="6"
                stroke="url(#paint1_linear_32_2985)"
                strokeWidth="1.75"
              />
              <defs>
                <linearGradient
                  id="paint0_linear_32_2985"
                  x1="15.9998"
                  y1="15"
                  x2="15.9998"
                  y2="19"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#2470FF" />
                  <stop offset="1" stopColor="#5792FF" />
                </linearGradient>
                <linearGradient
                  id="paint1_linear_32_2985"
                  x1="9.99927"
                  y1="5"
                  x2="9.9993"
                  y2="17"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#2470FF" />
                  <stop offset="1" stopColor="#5792FF" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <FilterButtons>
            <FilterButton
              $isActive={colorFilter === "all"}
              onClick={() => setColorFilter("all")}
            >
              All Warnings
            </FilterButton>
            <FilterButton
              $isActive={colorFilter === "red"}
              onClick={() => setColorFilter("red")}
            >
              Red
            </FilterButton>
            <FilterButton
              $isActive={colorFilter === "yellow"}
              onClick={() => setColorFilter("yellow")}
            >
              Yellow
            </FilterButton>
          </FilterButtons>
        </div>
      </HeaderWrapper>
      {loading && <p style={{ color: "white" }}>Loading...</p>}
      {error && <p style={{ color: "white" }}>{error}</p>}
      <MarketsWrapper>
        {sortedMarkets.map((market) => (
          <MarketWithWarningBubble
            key={market.id}
            market={{
              ...market,
              link: { url: market.link.url, name: market.link.name },
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

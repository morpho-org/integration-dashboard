import React, { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import OutOfBoundsMarketBubble from "../components/OutOfBoundsMarketBubble";
import { OutOfBoundsMarket } from "../utils/types";
import { getOutOfBoundsMarkets } from "../core/outOfBoundsMarkets";
import { getNetworkId } from "../utils/utils";
import {
  HeaderWrapper,
  MarketsWrapper,
  PageWrapper,
  TitleContainer,
  SortButton,
} from "./wrappers";
import styled from "styled-components";

// Updated styled components to mimic MarketsWithoutStrategyPage

const SearchWrapper = styled.div`
  position: relative;
  width: 400px;
`;

const SearchInput = styled.input`
  width: 100%;
  height: 40px;
  padding: 8px 16px 8px 48px;
  border-radius: 9999px;
  background: rgba(250, 250, 250, 0.1);
  color: white;
  font-size: 0.875rem;
  outline: none;

  &::placeholder {
    color: #a0a0a0;
  }

  &:focus {
    box-shadow: 0 0 0 2px #2973ff;
  }
`;

const SearchIcon = styled.svg`
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
`;

const SupplyFilterSelect = styled.select`
  width: 100%;
  max-width: 200px;
  height: 40px;
  padding: 8px 16px;
  border-radius: 9999px;
  background: rgba(250, 250, 250, 0.1);
  color: white;
  font-size: 0.875rem;
  border: none;
  outline: none;
  margin-left: 10px;
  &:focus {
    box-shadow: 0 0 0 2px #2973ff;
  }

  /* Optional: Remove default arrow for better consistency */
  appearance: none;
  background-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="%23FFFFFF"><path d="M7 10l5 5 5-5H7z"/></svg>');
  background-repeat: no-repeat;
  background-position: right 16px center;
  background-size: 16px;
`;

type OutOfBoundsMarketsPageProps = {
  network: "ethereum" | "base" | "polygon" | "unichain";
};

const OutOfBoundsMarketsPage: React.FC<OutOfBoundsMarketsPageProps> = ({
  network,
}) => {
  const [markets, setMarkets] = useState<OutOfBoundsMarket[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [supplyFilter, setSupplyFilter] = useState<number>(0);
  const [isSorted, setIsSorted] = useState<boolean>(false); // Updated sorting state

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

  const handleSortToggle = () => {
    setIsSorted(!isSorted);
  };

  const sortedMarkets = isSorted
    ? [...markets].sort((a, b) => b.totalSupplyUsd - a.totalSupplyUsd)
    : markets;

  const filteredMarkets = sortedMarkets.filter(
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
          <h1 style={{ color: "white", fontWeight: "300" }}>
            Out of Range Markets
          </h1>
          <h2 style={{ color: "white", fontWeight: "200" }}>
            {filteredMarkets.length}
          </h2>
        </TitleContainer>
        <div
          style={{ display: "flex", alignItems: "center", marginTop: "10px" }}
        >
          <SearchWrapper>
            <SearchInput
              type="text"
              placeholder="Search by Market ID"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <SearchIcon
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
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
            </SearchIcon>
          </SearchWrapper>
          <SupplyFilterSelect
            value={supplyFilter !== null ? supplyFilter : ""}
            onChange={(e) => setSupplyFilter(Number(e.target.value))}
          >
            <option value="0">No Threshold</option>
            <option value="1000">$1,000</option>
            <option value="10000">$10K</option>
            <option value="100000">$100K</option>
            <option value="1000000">$1M</option>
            <option value="10000000">$10M</option>
          </SupplyFilterSelect>
          {/* Updated Sort Button */}
          <SortButton onClick={handleSortToggle}>
            {isSorted ? "Unsort" : "Sort by Total"}
          </SortButton>
        </div>
      </HeaderWrapper>
      {loading && <p style={{ color: "white" }}>Loading...</p>}
      {error && <p style={{ color: "white" }}>{error}</p>}
      <MarketsWrapper style={{ marginTop: "20px" }}>
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

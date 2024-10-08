import React, { useEffect, useState } from "react";
import WithdrawQueueBubble from "../components/WithdrawQueueBubble";
import SupplyQueueBubble from "../components/SupplyQueueBubble";
import VaultFlowCapsBubble from "../components/VaultFlowCapsBubble";
import { VaultData } from "../utils/types";
import { getVaultDisplayData } from "../core/vaultData";
import { getNetworkId } from "../utils/utils";
import styled from "styled-components";
import {
  HeaderWrapper,
  PageWrapper,
  TitleContainer,
  VaultsWrapper,
} from "./wrappers";

// Add these styled components
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

const FilterSelect = styled.select`
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

  appearance: none;
  background-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="%23FFFFFF"><path d="M7 10l5 5 5-5H7z"/></svg>');
  background-repeat: no-repeat;
  background-position: right 16px center;
  background-size: 16px;
`;

const TableHeader = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 10px;
  padding: 10px;
  background-color: #1e2124;
  color: white;
  font-weight: bold;
  border-radius: 8px;
  margin-bottom: 10px;
`;

const VaultRow = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 10px;
  padding: 10px;
  background-color: #2c2f33;
  color: white;
  border-radius: 8px;
  margin-bottom: 5px;
  cursor: pointer;

  &:hover {
    background-color: #34383c;
  }
`;

const WarningText = styled.span`
  color: #c93333;
`;

const ExpandedContent = styled.div`
  grid-column: 1 / -1;
  background-color: #34383c;
  padding: 15px;
  border-radius: 0 0 8px 8px;
  margin-top: -5px;
`;

const BubbleContainer = styled.div`
  display: flex;
  justify-content: space-evenly;
  align-items: flex-start;
  margin-top: 10px;
  width: 100%;
`;

type VaultPageProps = {
  network: "ethereum" | "base";
};

const VaultPage: React.FC<VaultPageProps> = ({ network }) => {
  const [vaults, setVaults] = useState<VaultData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [warningFilter, setWarningFilter] = useState<string>("");
  const [curatorFilter, setCuratorFilter] = useState<string>("");

  const [expandedVault, setExpandedVault] = useState<string | null>(null);

  const fetchData = async (network: "ethereum" | "base") => {
    setLoading(true);
    setError(null);
    try {
      const data = await getVaultDisplayData(getNetworkId(network));
      setVaults(data);
    } catch (err) {
      setError("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(network);
  }, [network]);

  const allCurators = vaults
    .flatMap((vault) => vault.curators)
    .filter((value, index, self) => self.indexOf(value) === index);

  const filterByWarning = (vault: VaultData) => {
    switch (warningFilter) {
      case "WrongWithdrawQueue":
        return vault.warnings?.idlePositionWithdrawQueue === true;
      case "WrongSupplyQueue":
        return vault.warnings?.idlePositionSupplyQueue === true;
      case "MissingFlowCaps":
        return vault.warnings?.missingFlowCaps === true;
      default:
        return true;
    }
  };

  const filterByCurator = (vault: VaultData) => {
    if (curatorFilter === "") return true;
    return vault.curators.includes(curatorFilter);
  };

  const filteredVaults = vaults
    .filter(
      (vault) =>
        vault.vault.asset.symbol.toLowerCase().includes(filter.toLowerCase()) ||
        vault.vault.address.toLowerCase().includes(filter.toLowerCase())
    )
    .filter(filterByWarning)
    .filter(filterByCurator);

  const toggleExpand = (vaultName: string) => {
    setExpandedVault(expandedVault === vaultName ? null : vaultName);
  };

  return (
    <PageWrapper>
      <HeaderWrapper>
        <TitleContainer>
          <h1 style={{ color: "white", fontWeight: "300" }}>Morpho Vaults</h1>
        </TitleContainer>
        <div
          style={{ display: "flex", alignItems: "center", marginTop: "10px" }}
        >
          <SearchWrapper>
            <SearchInput
              type="text"
              placeholder="Search by asset or address..."
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
          <FilterSelect
            value={warningFilter}
            onChange={(e) => setWarningFilter(e.target.value)}
          >
            <option value="">All Vaults</option>
            <option value="WrongWithdrawQueue">Wrong Withdraw Queue</option>
            <option value="WrongSupplyQueue">Wrong Supply Queue</option>
            <option value="MissingFlowCaps">Missing Flow Caps</option>
          </FilterSelect>
          <FilterSelect
            value={curatorFilter}
            onChange={(e) => setCuratorFilter(e.target.value)}
          >
            <option value="">All Curators</option>
            {allCurators.map((curator, index) => (
              <option key={index} value={curator}>
                {curator}
              </option>
            ))}
          </FilterSelect>
        </div>
      </HeaderWrapper>
      {loading && <p style={{ color: "white" }}>Loading...</p>}
      {error && <p style={{ color: "white" }}>{error}</p>}
      <TableHeader
        style={{
          background: "transparent",
          color: "#2973FF",
          marginTop: "10px",
        }}
      >
        <div>Vault Name</div>
        <div>Withdraw Queue</div>
        <div>Supply Queue</div>
        <div>Flow Caps</div>
      </TableHeader>
      <VaultsWrapper style={{ marginTop: "10px" }}>
        {filteredVaults.map((vault) => (
          <React.Fragment key={vault.vault.link.name}>
            <VaultRow onClick={() => toggleExpand(vault.vault.link.name)}>
              <div>{vault.vault.link.name}</div>
              <div>
                {vault.warnings?.idlePositionWithdrawQueue ? (
                  <WarningText>Warning</WarningText>
                ) : (
                  "OK"
                )}
              </div>
              <div>
                {vault.warnings?.idlePositionSupplyQueue ? (
                  <WarningText>Warning</WarningText>
                ) : (
                  "OK"
                )}
              </div>
              <div>
                {vault.warnings?.missingFlowCaps ? (
                  <WarningText>Warning</WarningText>
                ) : (
                  "OK"
                )}
              </div>

              {expandedVault === vault.vault.link.name && (
                <ExpandedContent>
                  <BubbleContainer>
                    <WithdrawQueueBubble
                      expanded={true}
                      onClick={() => {}}
                      withdrawQueue={vault.withdrawQueue}
                      warnings={vault.warnings}
                    />
                    <SupplyQueueBubble
                      expanded={true}
                      onClick={() => {}}
                      supplyQueue={vault.supplyQueue}
                      warnings={vault.warnings}
                    />
                    <VaultFlowCapsBubble
                      expanded={true}
                      onClick={() => {}}
                      vault={vault}
                    />
                  </BubbleContainer>
                </ExpandedContent>
              )}
            </VaultRow>
          </React.Fragment>
        ))}
      </VaultsWrapper>
    </PageWrapper>
  );
};

export default VaultPage;

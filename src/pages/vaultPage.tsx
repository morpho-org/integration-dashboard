import React, { useEffect, useState } from "react";
import VaultBubble from "../components/VaultBubble";
import { VaultData } from "../utils/types";
import { getVaultDisplayData } from "../core/vaultData";
import { getNetworkId } from "../utils/utils";
import { FilterInput, PageWrapper, VaultsWrapper } from "./wrappers";
import styled from "styled-components";

type VaultPageProps = {
  network: "ethereum" | "base";
};

const TitleContainer = styled.div`
  flex-grow: 1;
  h1 {
    white-space: nowrap;
  }
`;

const FilterContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  width: 100%;
`;

const HeaderWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const VaultPage: React.FC<VaultPageProps> = ({ network }) => {
  const [vaults, setVaults] = useState<VaultData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [warningFilter, setWarningFilter] = useState<string>("");

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

  const filteredVaults = vaults
    .filter(
      (vault) =>
        vault.vault.asset.symbol.toLowerCase().includes(filter.toLowerCase()) ||
        vault.vault.address.toLowerCase().includes(filter.toLowerCase())
    )
    .filter(filterByWarning);

  return (
    <PageWrapper>
      <HeaderWrapper>
        <TitleContainer>
          <h1 style={{ color: "white" }}>Morpho Vaults</h1>
        </TitleContainer>
        <FilterContainer>
          <FilterInput
            type="text"
            placeholder="Filter by asset or address..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select
            value={warningFilter}
            onChange={(e) => setWarningFilter(e.target.value)}
            style={{ marginLeft: "20px", padding: "5px" }}
          >
            <option value="">All Vaults</option>
            <option value="WrongWithdrawQueue">Wrong Withdraw Queue</option>
            <option value="WrongSupplyQueue">Wrong Supply Queue</option>
            <option value="MissingFlowCaps">Missing Flow Caps</option>
          </select>
        </FilterContainer>
      </HeaderWrapper>
      {loading && <p>Loading...</p>}
      {error && <p>{error}</p>}
      <VaultsWrapper>
        {filteredVaults.map((vault) => (
          <VaultBubble key={vault.vault.name} vault={vault} />
        ))}
      </VaultsWrapper>
    </PageWrapper>
  );
};

export default VaultPage;

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
  const [curatorFilter, setCuratorFilter] = useState<string>("");

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

  return (
    <PageWrapper>
      <HeaderWrapper>
        <TitleContainer>
          <h1 style={{ color: "black", fontWeight: "300" }}>Morpho Vaults</h1>
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
            style={{
              marginLeft: "20px",
              padding: "5px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              outline: "none",
            }}
          >
            <option value="">All Vaults</option>
            <option value="WrongWithdrawQueue">Wrong Withdraw Queue</option>
            <option value="WrongSupplyQueue">Wrong Supply Queue</option>
            <option value="MissingFlowCaps">Missing Flow Caps</option>
          </select>
          <select
            value={curatorFilter}
            onChange={(e) => setCuratorFilter(e.target.value)}
            style={{
              marginLeft: "20px",
              padding: "5px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              outline: "none",
            }}
          >
            <option value="">All Curators</option>
            {allCurators.map((curator, index) => (
              <option key={index} value={curator}>
                {curator}
              </option>
            ))}
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

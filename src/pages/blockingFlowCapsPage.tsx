import React, { useEffect, useState } from "react";
import { BlockingFlowCaps, VaultWithBlockingFlowCaps } from "../utils/types";
import {
  FilterContainer,
  FilterInput,
  HeaderWrapper,
  PageWrapper,
  TitleContainer,
  VaultsWrapper,
} from "./wrappers";
import VaultWithBlockingFlowCapsBubble from "../components/VaultWithBlockingFlowCaps";
import { fetchBlockingFlowCaps } from "../fetchers/apiFetchers";
import { getNetworkId } from "../utils/utils";

type BlockingFlowCapsPageProps = {
  network: "ethereum" | "base";
};

const BlockingFlowCapsPage: React.FC<BlockingFlowCapsPageProps> = ({
  network,
}) => {
  const [vaults, setVaults] = useState<VaultWithBlockingFlowCaps[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [curatorFilter, setCuratorFilter] = useState<string>("");

  const fetchData = async (network: "ethereum" | "base") => {
    setLoading(true);
    setError(null);
    try {
      const blockingFlowCaps = await fetchBlockingFlowCaps(
        getNetworkId(network)
      );
      setVaults(groupByVault(blockingFlowCaps));
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
    .flatMap((vault) => vault.vault.curators)
    .filter((value, index, self) => self.indexOf(value) === index);

  const filterByCurator = (vault: VaultWithBlockingFlowCaps) => {
    if (curatorFilter === "") return true;
    return vault.vault.curators.includes(curatorFilter);
  };

  const filteredVaults = vaults
    .filter(
      (vault) =>
        vault.vault.underlyingAsset.symbol
          .toLowerCase()
          .includes(filter.toLowerCase()) ||
        vault.vault.address.toLowerCase().includes(filter.toLowerCase())
    )
    .filter(filterByCurator);

  return (
    <PageWrapper>
      <HeaderWrapper>
        <TitleContainer>
          <h1 style={{ color: "black", fontWeight: "300" }}>
            Vaults With Blocking Flow Caps
          </h1>
        </TitleContainer>
        <FilterContainer>
          <FilterInput
            type="text"
            placeholder="Filter by asset or address..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
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
          <VaultWithBlockingFlowCapsBubble
            key={vault.vault.link.name}
            vaultWithBlockingFlowCaps={vault}
          />
        ))}
      </VaultsWrapper>
    </PageWrapper>
  );
};

const groupByVault = (
  blockingFlowCaps: BlockingFlowCaps[]
): VaultWithBlockingFlowCaps[] => {
  const acc: Record<string, VaultWithBlockingFlowCaps> = {};

  for (const item of blockingFlowCaps) {
    if (!acc[item.vault.address]) {
      acc[item.vault.address] = { vault: item.vault, blockingFlowCaps: [] };
    }
    acc[item.vault.address].blockingFlowCaps.push(item);
  }

  return Object.values(acc);
};

export default BlockingFlowCapsPage;

import React, { useEffect, useState } from "react";
import VaultBubble from "../components/VaultBubble";
import { VaultMissingFlowCaps } from "../utils/types";
import { getMissingFlowCaps } from "../core/missingFlowCaps";
import { getNetworkId } from "../utils/utils";
import {
  FilterInput,
  HeaderWrapper,
  PageWrapper,
  VaultsWrapper,
} from "./wrappers";

type FlowCapsPageProps = {
  network: "ethereum" | "base";
};

const FlowCapsPage: React.FC<FlowCapsPageProps> = ({ network }) => {
  const [vaults, setVaults] = useState<VaultMissingFlowCaps[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");

  const fetchData = async (network: "ethereum" | "base") => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMissingFlowCaps(getNetworkId(network));
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

  const filteredVaults = vaults.filter((vault) =>
    vault.vault.asset.symbol.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <PageWrapper>
      <HeaderWrapper>
        <h1 style={{ color: "white" }}>Flow Caps</h1>
        <FilterInput
          type="text"
          placeholder="Filter by asset symbol..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
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

export default FlowCapsPage;

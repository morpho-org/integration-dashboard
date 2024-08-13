import React, { useEffect, useState } from "react";
import VaultBubble from "../components/VaultBubble";
import { VaultMissingFlowCaps } from "../utils/types";
import { getMissingFlowCaps } from "../core/missingFlowCaps";
import { getNetworkId } from "../utils/utils";

type FlowCapsPageProps = {
  network: "ethereum" | "base";
};

const FlowCapsPage: React.FC<FlowCapsPageProps> = ({ network }) => {
  const [vaults, setVaults] = useState<VaultMissingFlowCaps[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div>
      <header className="App-header">
        <h1>Flow Caps</h1>
        {loading && <p>Loading...</p>}
        {error && <p>{error}</p>}
        <div>
          {vaults.map((vault) => (
            <VaultBubble key={vault.vault.name} vault={vault} />
          ))}
        </div>
      </header>
    </div>
  );
};

export default FlowCapsPage;

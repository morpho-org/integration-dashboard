import React, { useEffect, useState } from "react";
import VaultBubble from "./components/VaultBubble";
import { VaultMissingFlowCaps } from "./utils/types";
import { getMissingFlowCaps } from "./core/missingFlowCaps";
import { getNetworkId } from "./utils/utils";
import "./styles/App.css";
import "./styles/index.css";

const App: React.FC = () => {
  const [network, setNetwork] = useState<"ethereum" | "base">("ethereum");
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

  const handleNetworkSwitch = () => {
    setNetwork((prevNetwork) =>
      prevNetwork === "ethereum" ? "base" : "ethereum"
    );
  };

  return (
    <div className="App">
      <button onClick={handleNetworkSwitch}>
        Switch to {network === "ethereum" ? "Base" : "Ethereum"}
      </button>
      {loading && <p>Loading...</p>}
      {error && <p>{error}</p>}
      <div>
        {vaults.map((vault) => (
          <VaultBubble key={vault.vault.name} vault={vault} />
        ))}
      </div>
    </div>
  );
};

export default App;

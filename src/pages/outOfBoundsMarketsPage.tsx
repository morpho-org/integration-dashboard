import React, { useEffect, useState } from "react";
import OutOfBoundsMarketBubble from "../components/OutOfBoundsMarketBubble";
import { OutOfBoundsMarket } from "../utils/types";
import { getOutOfBoundsMarkets } from "../core/outOfBoundsMarkets";
import { getNetworkId } from "../utils/utils";

type OutOfBoundsMarketsPageProps = {
  network: "ethereum" | "base";
};

const OutOfBoundsMarketsPage: React.FC<OutOfBoundsMarketsPageProps> = ({
  network,
}) => {
  const [markets, setMarkets] = useState<OutOfBoundsMarket[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div>
      <h1>Out of Range Markets</h1>
      {loading && <p>Loading...</p>}
      {error && <p>{error}</p>}
      <div>
        {markets.map((market) => (
          <OutOfBoundsMarketBubble key={market.id} market={market} />
        ))}
      </div>
    </div>
  );
};

export default OutOfBoundsMarketsPage;

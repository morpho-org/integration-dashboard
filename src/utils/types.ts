export type Asset = {
  address: string;
  decimals: bigint;
  symbol: string;
  priceUsd: number;
};

export type FlowCaps = {
  maxIn: bigint;
  maxOut: bigint;
};

export type MetaMorphoVault = {
  symbol: string;
  address: string;
  name: string;
  asset: Asset;
  totalAssets: number;
  markets: {
    id: string;
    name: string;
    link: string;
    flowCaps: FlowCaps;
  }[];
};

export type VaultDisplayData = {
  name: string;
  link: string;
  asset: Asset;
  totalAssetsUsd: number;
};

export type Strategy = {
  id: string;
  blacklist?: boolean;
  idleMarket?: boolean;
  utilizationTarget?: bigint;
  targetBorrowApy?: bigint;
  apyRange?: Range;
  utilizationRange?: Range;
};

export type WhitelistedVault = {
  address: string;
};

export type VaultMissingFlowCaps = {
  vault: VaultDisplayData;
  marketsWithMissingFlowCaps: MarketMissingFlowCaps[];
};

export type MarketMissingFlowCaps = {
  id: string;
  name: string;
  link: string;
  maxInUsd: number | undefined;
  maxOutUsd: number | undefined;
};

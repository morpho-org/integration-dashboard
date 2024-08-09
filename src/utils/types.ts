export type Asset = {
  address: string;
  decimals: bigint;
  symbol: string;
  priceUsd: number;
};

export type Apys = {
  borrowApy: bigint;
  supplyApy: bigint;
};

export type ApyTarget = {
  apyTarget: bigint;
  apyRange: Range;
};

export type FlowCaps = {
  maxIn: bigint;
  maxOut: bigint;
};

export type MarketChainData = {
  marketState: MarketState;
  borrowRate: bigint;
  rateAtTarget: bigint;
  apys: Apys;
};

export type MarketState = {
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
  lastUpdate: bigint;
  fee: bigint;
};

export type MarketParams = {
  loanToken: string;
  collateralToken: string;
  oracle: string;
  irm: string;
  lltv: bigint;
};

export type MetaMorphoVaultFlowCaps = {
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
    supplyAssets: bigint;
    supplyCap: bigint;
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

export type Range = {
  lowerBound: bigint;
  upperBound: bigint;
};

export type UtilizationTarget = {
  utilizationTarget: bigint;
  utilizationRange: Range;
};

export type VaultMissingFlowCaps = {
  vault: VaultDisplayData;
  markets: MarketFlowCaps[];
};

export type WhitelistedMarket = {
  id: string;
  loanAsset: Asset;
  collateralAsset: Asset;
  marketParams: MarketParams;
  marketChainData: MarketChainData;
  strategy: Strategy;
};

export type WhitelistedVault = {
  address: string;
};

export type MarketFlowCaps = {
  id: string;
  name: string;
  link: string;
  maxInUsd: string;
  maxOutUsd: string;
  supplyAssetsUsd: string;
  supplyCapUsd: string;
  missing: boolean;
};

export type OutOfBoundsMarket = {
  id: string;
  name: string;
  link: string;
  loanAsset: Asset;
  collateralAsset: Asset;
  totalSupplyUsd: string;
  utilization: bigint;
  apys: Apys;
  target: ApyTarget | UtilizationTarget;
};

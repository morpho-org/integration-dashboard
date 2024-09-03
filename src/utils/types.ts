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

export type InteractionData = {
  amount: bigint;
  newUtilization: bigint;
};

export type MarketData = {
  id: string;
  name: string;
  marketParams: MarketParams;
  marketState: MarketState;
  borrowRate: bigint;
  rateAtTarget: bigint;
  apys: Apys;
  targetApy?: bigint;
  targetUtilization?: bigint;
  reallocationData?: ReallocationData;
  loanAsset: Asset;
  collateralAsset: Asset;
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

export type MarketReallocationData = {
  id: string;
  name: string;
  link: string;
  supplyReallocation: boolean; // true if the out of bounds market is above the target range (we need to supply in it), but not this market.
  maxReallocationAmount: bigint;
  supplyAssets: bigint;
  amountToReachCap: bigint;
  amountToReachTarget: bigint;
  flowCap: bigint;
  target:
    | {
        borrowApy: bigint;
        apyTarget: bigint;
      }
    | {
        utilization: bigint;
        utilizationTarget: bigint;
      };
  warnings?: {
    targetTooCloseOrAlreadyCrossed: boolean;
    flowCapTooLow: boolean;
    allocationOrCapInsufficient: boolean;
  };
};

export type MetaMorphoVault = {
  address: string;
  name: string;
  link: string;
  underlyingAsset: Asset;
  totalAssetsUsd: number;
  positions: { [key: string]: MetaMorphoPosition };
  flowCaps: { [key: string]: FlowCaps };
};

export type MetaMorphoVaultFlowCaps = {
  symbol: string;
  address: string;
  name: string;
  asset: Asset;
  totalAssets: number;
  supplyQueue: Queue;
  withdrawQueue: Queue;
  markets: {
    id: string;
    name: string;
    link: string;
    flowCaps: FlowCaps;
    supplyAssets: bigint;
    supplyCap: bigint;
    idle?: boolean;
  }[];
};

export type MetaMorphoAPIData = {
  symbol: string;
  name: string;
  address: string;
  asset: Asset;
  state: {
    totalAssets: number;
    apy: number;
    netApy: number;
    fee: number;
    allocation: {
      market: {
        uniqueKey: string;
      };
      supplyAssets: number;
      supplyCap: number;
    }[];
  };
};

export type MetaMorphoPosition = {
  marketData: MarketData;
  supplyAssets: bigint;
  supplyCap: bigint;
};

export type VaultDisplayData = {
  name: string;
  link: string;
  asset: Asset;
  totalAssetsUsd: number;
};

export type Queue = {
  link: string;
  name: string;
  idle?: boolean;
}[];

export type Reallocation = {
  withdrawals: Withdrawal[];
  supplyMarketParams: MarketParams;
  logData: ReallocationLogData[];
  amountReallocated: bigint;
  newState: {
    apys: Apys;
    utilization: bigint;
  };
  totalUsd: number;
};

export type ReallocationData = {
  toSupply: bigint;
  toWithdraw: bigint;
  toBorrow: bigint;
};

export type ReallocationLogData = {
  marketId: string;
  marketName: string;
  withdrawMax: boolean;
  supplyMax: boolean;
  toSupply: bigint;
  toWithdraw: bigint;
  previousUtilization: bigint;
  newUtilization: bigint;
  previousSupplyAPY: bigint;
  newSupplyAPY: bigint;
  previousBorrowAPY: bigint;
  newBorrowAPY: bigint;
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
  supplyQueue: Queue;
  withdrawQueue: Queue;
  warnings: VaultWarnings;
};

export type VaultReallocationData = {
  supplyReallocation: boolean;
  vault: MetaMorphoVault;
  marketReallocationData: MarketReallocationData[];
  reallocation?: Reallocation;
};

export type VaultWarnings = {
  missingFlowCaps?: boolean;
  idlePositionWithdrawQueue?: boolean;
  idlePositionSupplyQueue?: boolean;
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

export type Withdrawal = {
  marketParams: MarketParams;
  amount: bigint;
};

export type MarketFlowCaps = {
  id: string;
  name: string;
  link: string;
  maxInUsd: string;
  maxOutUsd: string;
  supplyAssetsUsd: number;
  supplyAssetsUsdFormatted: string;
  supplyAssetsFormatted: string;
  supplyCapUsd: string;
  missing: boolean;
};

export type OutOfBoundsMarket = {
  id: string;
  name: string;
  link: string;
  loanAsset: Asset;
  collateralAsset: Asset;
  totalSupplyUsd: number;
  utilization: bigint;
  marketChainData: MarketChainData;
  target: ApyTarget | UtilizationTarget;
  amountToReachTarget: bigint;
  aboveRange: boolean;
};

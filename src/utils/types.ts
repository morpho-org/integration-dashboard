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
  distanceToTarget: bigint;
  upperBoundCrossed: boolean;
};

export type BlockingFlowCaps = {
  vault: {
    address: string;
    link: Link;
    underlyingAsset: Asset;
    curators: string[];
  };
  market: Link;
  maxIn?: bigint;
  maxOut?: bigint;
  timestamp: number;
  blockedMarkets: Link[];
};

export type FlowCaps = {
  maxIn: bigint;
  maxOut: bigint;
};

export type InteractionData = {
  amount: bigint;
  newUtilization: bigint;
};

export type Link = {
  name: string;
  url: string;
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
  utilization?: bigint;
  apyAtTarget?: bigint;
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
  link: Link;
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

export type MarketWithWarning = {
  id: string;
  link: Link;
  warnings: MarketWarning[];
  loanAsset: {
    symbol: string;
  };
  collateralAsset: {
    symbol: string;
  };
  red: boolean;
  supplyAmount: string;
  borrowAmount: string;
  collateralAmount: string;
};

export type MarketWithWarningAPIData = {
  uniqueKey: string;
  lltv: bigint;
  loanAsset: {
    symbol: string;
  };
  collateralAsset: {
    symbol: string;
  };
  warnings: MarketWarning[];
  state: {
    supplyAssetsUsd: bigint;
    borrowAssetsUsd: bigint;
    collateralAssetsUsd: bigint;
  };
};

export type MarketWithoutStrategy = {
  id: string;
  link: Link;
  loanAsset: {
    symbol: string;
  };
  collateralAsset: {
    symbol: string;
  };
};

export type MarketWithoutStrategyAPIData = {
  uniqueKey: string;
  loanAsset: {
    symbol: string;
  };
  collateralAsset: {
    symbol: string;
  };
  lltv: bigint;
};

export type MarketWarning = {
  type: string;
  level: string;
};

export type MetaMorphoVault = {
  address: string;
  link: Link;
  underlyingAsset: Asset;
  totalAssetsUsd: number;
  positions: { [key: string]: MetaMorphoPosition };
  flowCaps: { [key: string]: FlowCaps };
};

export type MetaMorphoVaultData = {
  symbol: string;
  address: string;
  isWhitelisted: boolean;
  name: string;
  asset: Asset;
  totalAssets: number;
  totalAssetsUsd: number;
  supplyQueue: Queue;
  withdrawQueue: Queue;
  curators: string[];
  allocators: string[];
  factoryAddress?: string;
  timelock?: number;
  markets: {
    id: string;
    link: Link;
    flowCaps: FlowCaps;
    supplyAssets: bigint;
    supplyCap: bigint;
    idle?: boolean;
  }[];
  owner: string;
  ownerSafeDetails: {
    isSafe: boolean;
    owners?: string[];
    threshold?: string;
    version?: string;
    multisigConfig?: string;
  };
  curator: string;
  curatorSafeDetails: {
    isSafe: boolean;
    owners?: string[];
    threshold?: string;
    version?: string;
    multisigConfig?: string;
  };
};

export type MetaMorphoAPIData = {
  symbol: string;
  name: string;
  address: string;
  asset: Asset;
  metadata: { curators: { name: string }[] };
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
  link: Link;
  address: string;
  asset: Asset;
  totalAssetsUsd: number;
};

export type Queue = {
  link: Link;
  idle?: boolean;
  id?: string;
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
  distanceToTarget: bigint;
  upperBoundCrossed: boolean;
};

export type VaultData = {
  vault: VaultDisplayData;
  isV1_1: boolean;
  timelock?: number;
  curators: string[];
  markets: MarketFlowCaps[];
  supplyQueue: Queue;
  withdrawQueue: Queue;
  warnings: VaultWarnings;
  owner: string;
  ownerSafeDetails: {
    isSafe: boolean;
    owners?: string[];
    threshold?: string;
    version?: string;
    multisigConfig?: string;
  };
  curator: string;
  curatorSafeDetails: {
    isSafe: boolean;
    owners?: string[];
    threshold?: string;
    version?: string;
    multisigConfig?: string;
  };
  publicAllocatorIsAllocator: boolean;
  isWhitelisted: boolean;
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
  idleSupplyQueueWarningReason?: string;
  allCapsTo0?: boolean;
  supplyQueueStatus?: string;
};

export type VaultWithBlockingFlowCaps = {
  vault: {
    address: string;
    link: Link;
    underlyingAsset: Asset;
    curators: string[];
  };
  blockingFlowCaps: BlockingFlowCaps[];
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
  link: Link;
  maxInUsd: string;
  maxOutUsd: string;
  supplyAssetsUsd: number;
  supplyAssetsUsdFormatted: string;
  supplyAssetsFormatted: string;
  supplyCapUsd: string;
  missing: boolean;
  idle: boolean;
};

export type OutOfBoundsMarket = {
  id: string;
  link: Link;
  loanAsset: Asset;
  collateralAsset: Asset;
  totalSupplyUsd: number;
  utilization: bigint;
  marketChainData: MarketChainData;
  target: ApyTarget | UtilizationTarget;
  amountToReachTarget: bigint;
  aboveRange: boolean;
};

export interface DefiLlamaResponse {
  coins: {
    [key: string]: {
      decimals: number;
      symbol: string;
      price: number;
      timestamp: number;
      confidence: number;
    };
  };
}

export interface AssetPriceInfoDL {
  decimals: number;
  symbol: string;
  price: number;
  timestamp: number;
  confidence: number;
}

export interface MarketTarget {
  id: string;
  uniqueKey: string;
  targetBorrowUtilization: string;
  targetWithdrawUtilization: string;
}

export interface ApiTargetsResponse {
  data: {
    markets: {
      items: MarketTarget[];
    };
    vaults?: {
      items: {
        id: string;
        address: string;
        publicAllocatorConfig: {
          fee: string;
        };
      }[];
    };
  };
}

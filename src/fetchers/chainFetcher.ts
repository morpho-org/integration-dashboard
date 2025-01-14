import { Contract, Provider, ZeroAddress } from "ethers";
import {
  AdaptiveCurveIrm__factory,
  BlueIrm__factory,
  MetaMorpho__factory,
  MorphoBlue,
  MorphoBlue__factory,
  PublicAllocator__factory,
} from "ethers-types";
import {
  Asset,
  FlowCaps,
  MarketChainData,
  MarketData,
  MarketParams,
  Strategy,
} from "../utils/types";
import {
  MORPHO,
  publicAllocatorAddress,
  WAD,
  YEAR,
  BATCH_SIZE,
} from "../config/constants";
import { getMarketId, getMarketName } from "../utils/utils";
import {
  accrueInterest,
  computeRateAtTarget,
  computeUtilization,
  getReallocationData,
  toAssetsDown,
  wMulDown,
  wTaylorCompounded,
} from "../utils/maths";
import { fetchAssetData } from "./apiFetchers";
import safeAbi from "../abis/safeAbi.json";

export const fetchMarketParamsAndData = async (
  marketId: string,
  provider: Provider
) => {
  const morpho = MorphoBlue__factory.connect(MORPHO, provider);
  const marketParams = await fetchMarketParams(morpho, marketId);
  const marketChainData = await fetchMarketChainData(
    morpho,
    marketParams,
    provider
  );
  return { marketParams, marketChainData };
};

export const fetchMarketParams = async (
  morphoBlue: MorphoBlue,
  id: string
): Promise<MarketParams> => {
  try {
    const marketParams_ = await morphoBlue.idToMarketParams(id);
    const marketParams: MarketParams = {
      loanToken: marketParams_.loanToken,
      collateralToken: marketParams_.collateralToken,
      oracle: marketParams_.oracle,
      irm: marketParams_.irm,
      lltv: marketParams_.lltv,
    };
    return marketParams;
  } catch (error) {
    console.error("Error fetching market params", error);
    throw error;
  }
};

export const fetchMarketChainData = async (
  morphoBlue: MorphoBlue,
  marketParams: MarketParams,
  provider: Provider
): Promise<MarketChainData> => {
  try {
    const id = getMarketId(marketParams);
    const [block, market_, previousRateAtTarget] = await Promise.all([
      provider.getBlock("latest"),
      morphoBlue.market(id),
      fetchRateAtTarget(marketParams, provider),
    ]);

    const market = {
      totalSupplyAssets: market_.totalSupplyAssets,
      totalSupplyShares: market_.totalSupplyShares,
      totalBorrowAssets: market_.totalBorrowAssets,
      totalBorrowShares: market_.totalBorrowShares,
      lastUpdate: market_.lastUpdate,
      fee: market_.fee,
    };
    const rateAtTarget = computeRateAtTarget(
      market,
      previousRateAtTarget,
      BigInt(block!.timestamp)
    );

    let marketState = market;
    let borrowRate = 0n;
    const irmAddress = marketParams.irm;
    const irm = BlueIrm__factory.connect(irmAddress, provider);

    if (irmAddress !== ZeroAddress) {
      borrowRate = await irm.borrowRateView(marketParams, market);
      if (borrowRate !== 0n) {
        marketState = accrueInterest(
          BigInt(block!.timestamp),
          market,
          borrowRate
        );
      }
    }

    const utilization = computeUtilization(
      marketState.totalBorrowAssets,
      marketState.totalSupplyAssets
    );

    const borrowApy = wTaylorCompounded(borrowRate, YEAR);
    const supplyApyNoFee = wMulDown(borrowApy, utilization);
    const supplyApy = wMulDown(supplyApyNoFee, WAD - marketState.fee);

    return {
      marketState,
      borrowRate,
      rateAtTarget,
      apys: { borrowApy, supplyApy },
    };
  } catch (error) {
    console.error("Error fetching market chain data", error);
    throw error;
  }
};

export const fetchFlowCaps = async (
  vaultAddress: string,
  marketId: string,
  networkId: number,
  provider: Provider
): Promise<FlowCaps> => {
  const publicAllocator = PublicAllocator__factory.connect(
    publicAllocatorAddress[networkId]!,
    provider
  );

  try {
    const caps = await publicAllocator.flowCaps(vaultAddress, marketId);
    return { maxIn: caps[0], maxOut: caps[1] };
  } catch (error) {
    console.error("Error fetching flow caps", error);
    throw error;
  }
};

const fetchRateAtTarget = async (
  marketParams: MarketParams,
  provider: Provider
): Promise<bigint> => {
  const id = getMarketId(marketParams);

  const irm = AdaptiveCurveIrm__factory.connect(marketParams.irm, provider);

  return marketParams.irm !== ZeroAddress ? await irm.rateAtTarget(id) : 0n;
};

export const fetchVaultMarketPositionAndCap = async (
  provider: Provider,
  marketId: string,
  vaultAdress: string
) => {
  const morpho = MorphoBlue__factory.connect(MORPHO, provider);
  const vault = MetaMorpho__factory.connect(vaultAdress, provider);
  const [market, position, config] = await Promise.all([
    morpho.market(marketId),
    morpho.position(marketId, vault),
    vault.config(marketId),
  ]);

  const supplyCap = config.cap;
  const supplyAssets = toAssetsDown(
    position.supplyShares,
    market.totalSupplyAssets,
    market.totalSupplyShares
  );

  return { supplyAssets, supplyCap };
};

export const getFlowCaps = async (
  vaultAddress: string,
  enabledMarkets: string[],
  networkId: number,
  provider: Provider
) => {
  const flowCaps: { [key: string]: FlowCaps } = {};
  const allFlowCaps = await Promise.all(
    enabledMarkets.map((id) =>
      fetchFlowCaps(vaultAddress, id, networkId, provider)
    )
  );
  for (let i = 0; i < enabledMarkets.length; i++) {
    flowCaps[enabledMarkets[i]] = allFlowCaps[i];
  }
  return flowCaps;
};

export const getQueues = async (vaultAddress: string, provider: Provider) => {
  const vault = MetaMorpho__factory.connect(vaultAddress, provider);

  const [withdrawQueueLength, supplyQueueLength] = await Promise.all([
    vault.withdrawQueueLength(),
    vault.supplyQueueLength(),
  ]);

  const withdrawQueueOrder = await Promise.all(
    Array.from({ length: Number(withdrawQueueLength) }, (_, i) =>
      vault.withdrawQueue(i)
    )
  );
  const supplyQueueOrder = await Promise.all(
    Array.from({ length: Number(supplyQueueLength) }, (_, i) =>
      vault.supplyQueue(i)
    )
  );

  return { withdrawQueueOrder, supplyQueueOrder };
};

export const getMarketParamsAndData = async (
  marketId: string,
  morpho: MorphoBlue,
  provider: Provider
) => {
  const marketParams = await fetchMarketParams(morpho, marketId);
  const marketChainData = await fetchMarketChainData(
    morpho,
    marketParams,
    provider
  );
  return { marketParams, marketChainData };
};

export const getVaultMarketData = async (
  marketId: string,
  loanAsset: Asset,
  strategies: Strategy[],
  morpho: MorphoBlue,
  provider: Provider
) => {
  const { marketParams, marketChainData } = await getMarketParamsAndData(
    marketId,
    morpho,
    provider
  );

  const collateralAsset =
    marketParams.collateralToken === ZeroAddress
      ? { address: ZeroAddress, decimals: 0n, symbol: "", priceUsd: 0 }
      : await fetchAssetData(marketParams.collateralToken);

  const name = getMarketName(
    loanAsset.symbol,
    collateralAsset.symbol,
    marketParams.lltv
  );

  const strategy = strategies.find((strategy) => strategy.id === marketId);

  const marketData: MarketData = {
    id: marketId,
    name,
    marketParams,
    marketState: marketChainData.marketState,
    borrowRate: marketChainData.borrowRate,
    rateAtTarget: marketChainData.rateAtTarget,
    apys: {
      borrowApy: marketChainData.apys.borrowApy,
      supplyApy: marketChainData.apys.supplyApy,
    },
    targetApy: strategy?.targetBorrowApy,
    targetUtilization: strategy?.utilizationTarget,
    reallocationData: getReallocationData(marketChainData, strategy),
    loanAsset,
    collateralAsset,
  };
  return marketData;
};

export async function checkIfSafeBatch(
  provider: Provider,
  addresses: string[]
) {
  console.log("checking: ", addresses);
  const results: {
    [address: string]: {
      isSafe: boolean;
      owners?: string[];
      threshold?: string;
      multisigConfig?: string;
    };
  } = {};

  // Process addresses in batches
  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE);

    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(async (address) => {
        try {
          // First check if address has code
          const code = await provider.getCode(address).catch(() => "0x");
          if (code === "0x") {
            return [address, { isSafe: false }] as const;
          }

          const safe = new Contract(address, safeAbi, provider);

          // Try to call Safe-specific methods
          const [owners, threshold] = await Promise.all([
            safe.getOwners().catch(() => null),
            safe.getThreshold().catch(() => null),
          ]);

          if (!owners || !threshold) {
            return [address, { isSafe: false }] as const;
          }

          return [
            address,
            {
              isSafe: true,
              owners,
              threshold: threshold.toString(),
              multisigConfig: `${threshold} out of ${owners.length} owners required`,
            },
          ] as const;
        } catch (error) {
          return [address, { isSafe: false }] as const;
        }
      })
    );

    // Add batch results to the overall results
    batchResults.forEach((item) => {
      const [address, result] = item as [
        string,
        {
          isSafe: boolean;
          owners?: string[];
          threshold?: string;
          multisigConfig?: string;
        }
      ];
      results[address] = result;
    });

    // Optional: Add a small delay between batches to prevent rate limiting
    if (i + BATCH_SIZE < addresses.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

// You can keep the original checkIfSafe as a wrapper for single address checks
export async function checkIfSafe(provider: Provider, address: string) {
  const results = await checkIfSafeBatch(provider, [address]);
  return results[address];
}

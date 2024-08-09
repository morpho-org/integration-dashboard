import { Provider, ZeroAddress } from "ethers";
import {
  AdaptiveCurveIrm__factory,
  BlueIrm__factory,
  MorphoBlue,
  MorphoBlue__factory,
  PublicAllocator__factory,
} from "ethers-types";
import { FlowCaps, MarketChainData, MarketParams } from "../utils/types";
import { MORPHO, publicAllocatorAddress, WAD, YEAR } from "../config/constants";
import { getMarketId } from "../utils/utils";
import {
  accrueInterest,
  computeRateAtTarget,
  computeUtilization,
  wMulDown,
  wTaylorCompounded,
} from "../utils/maths";

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

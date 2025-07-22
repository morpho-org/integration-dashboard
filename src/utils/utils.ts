import { encodeAbiParameters, keccak256 } from "viem";
import { pow10 } from "./maths";
import {
  Apys,
  Asset,
  MarketParams,
  MarketWithWarning,
  MarketWithWarningAPIData,
  Range,
  VaultReallocationData,
  Withdrawal,
} from "./types";
import { arbitrum, base, mainnet, polygon, unichain } from "viem/chains";
import { katana } from "../wagmi";

export const isApyOutOfRange = (apys: Apys, range: Range) => {
  return apys.supplyApy < range.lowerBound || apys.borrowApy > range.upperBound;
};

export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

export const isUtilizationOutOfRange = (utilization: bigint, range: Range) => {
  return utilization < range.lowerBound || utilization > range.upperBound;
};

export const getMarketId = (market: MarketParams) => {
  const encodedMarket = encodeAbiParameters(
    [
      { name: "loanToken", type: "address" },
      { name: "collateralToken", type: "address" },
      { name: "oracle", type: "address" },
      { name: "irm", type: "address" },
      { name: "lltv", type: "uint256" },
    ],
    [
      market.loanToken as `0x${string}`,
      market.collateralToken as `0x${string}`,
      market.oracle as `0x${string}`,
      market.irm as `0x${string}`,
      market.lltv,
    ]
  );
  return keccak256(encodedMarket);
};

export const getNetworkDBBlockingFlowCapsKey = (network: string): string => {
  switch (network) {
    case "ethereum":
      return "mainnetBlockingFlowCaps";
    case "base":
      return "baseBlockingFlowCaps";
    case "polygon":
      return "polygonBlockingFlowCaps";
    case "unichain":
      return "unichainBlockingFlowCaps";
    case "katana":
      return "katanaBlockingFlowCaps";
    case "arbitrum":
      return "arbitrumBlockingFlowCaps";
    default:
      throw new Error(`Invalid network: ${network}`);
  }
};

export const getNetworkId = (network: string): number => {
  switch (network) {
    case "ethereum":
      return 1;
    case "base":
      return 8453;
    case "polygon":
      return 137;
    case "unichain":
      return 130;
    case "katana":
      return 747474;
    case "arbitrum":
      return 42161;
  }
  throw new Error("Invalid chainId");
};

export const getNetworkName = (networkId: number): string => {
  switch (networkId) {
    case 1:
      return "ethereum";
    case 8453:
      return "base";
    case 137:
      return "polygon";
    case 130:
      return "unichain";
    case 747474:
      return "katana";
    case 42161:
      return "arbitrum";
  }
  throw new Error("Invalid chainId");
};

export const getMarketName = (
  loanSymbol: string,
  collateralSymbol: string | null,
  lltv: bigint
): string => {
  if (!collateralSymbol) {
    return `${loanSymbol} idle market`;
  } else {
    return `${collateralSymbol}/${loanSymbol} (${formatWAD(lltv)})`;
  }
};

export const formatWAD = (wad: bigint, precision = 2) => {
  return `${(Number(wad) / 1e16).toFixed(precision)}%`;
};

export const formatUsdAmount = (amount: number, precision = 2) => {
  if (amount === 0) return "$0";
  if (+amount.toFixed(precision) === 0) return "<$0.01";

  if (amount / 1000 < 1) return `$${amount.toFixed(precision)}`;

  if (amount / 1e6 < 1) return `$${(amount / 1000).toFixed(precision)}K`;

  if (amount / 1e9 < 1) return `$${(amount / 1e6).toFixed(precision)}M`;

  if (amount / 1e12 < 1) return `$${(amount / 1e9).toFixed(precision)}B`;

  return `$${(amount / 1e12).toFixed(precision)}T`;
};

export const formatTokenAmount = (
  amount: bigint,
  asset: Asset,
  precision = 2
) => {
  const assets = Number(amount) / Number(pow10(asset.decimals));
  if (assets < 1000) return `${assets.toFixed(precision)} ${asset.symbol}`;
  if (assets < 1e6)
    return `${(assets / 1000).toFixed(precision)}K ${asset.symbol}`;
  if (assets < 1e9)
    return `${(assets / 1e6).toFixed(precision)}M ${asset.symbol}`;
  if (assets < 1e12)
    return `${(assets / 1e9).toFixed(precision)}B ${asset.symbol}`;
  return `${(assets / 1e12).toFixed(precision)}T ${asset.symbol}`;
};

export const formatMarketLink = (id: string, networkId: number) => {
  return `https://app.morpho.org/market?id=${id}&network=${getNetworkName(
    networkId
  )}`;
};

export const formatVaultLink = (address: string, networkId: number) => {
  return `https://app.morpho.org/vault?vault=${address}&network=${getNetworkName(
    networkId
  )}`;
};

export const sortWithdrawals = (withdrawals: Withdrawal[]) => {
  return withdrawals.sort(
    (a, b) =>
      parseInt(getMarketId(a.marketParams)) -
      parseInt(getMarketId(b.marketParams))
  );
};

export const sortVaultReallocationData = (vaults: VaultReallocationData[]) => {
  const vaultWithReallocation = vaults.filter(
    (vault) => vault.reallocation !== undefined
  );
  const vaultWithoutReallocation = vaults.filter(
    (vault) => vault.reallocation === undefined
  );

  return [
    ...vaultWithReallocation.sort(
      (a, b) => b.reallocation!.totalUsd - a.reallocation!.totalUsd
    ),
    ...vaultWithoutReallocation.sort(
      (a, b) => b.vault.totalAssetsUsd - a.vault.totalAssetsUsd
    ),
  ];
};

export const formatMarketWithWarning = (
  market: MarketWithWarningAPIData,
  networkId: number
): MarketWithWarning => {
  const warnings = market.warnings!;
  const red = warnings.some((warning) => warning.level === "RED");
  const name = getMarketName(
    market.loanAsset.symbol,
    market.collateralAsset ? market.collateralAsset.symbol : null,
    market.lltv
  );
  const link = formatMarketLink(market.uniqueKey, networkId);
  return {
    id: market.uniqueKey,
    link: { url: link, name },
    warnings,
    red,
    collateralAsset: market.collateralAsset,
    loanAsset: market.loanAsset,
    supplyAmount: Number(market.state.supplyAssetsUsd).toString(),
    borrowAmount: Number(market.state.borrowAssetsUsd).toString(),
    collateralAmount: Number(market.state.collateralAssetsUsd).toString(),
  };
};

export const extractIdFromUrl = (url: string) => {
  return url.split("id=")[1].split("&")[0];
};

export const handleLinkClick = (event: React.MouseEvent) => {
  event.stopPropagation();
};


export const chainMapping = {
  1: mainnet,
  130: unichain,
  137: polygon,
  8453: base,
  747474: katana,
  42161: arbitrum,
};
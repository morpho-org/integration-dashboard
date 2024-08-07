import { ethers } from "ethers";

export const getProvider = (chainId: number): ethers.JsonRpcProvider => {
  let endpoint: string | undefined;

  if (chainId === 1) {
    endpoint = process.env.REACT_APP_RPC_URL_MAINNET;
    console.log("chaindId: 1 - Ethereum Mainnet");
  } else if (chainId === 8453) {
    endpoint = process.env.REACT_APP_RPC_URL_BASE;
    console.log("chaindId: 8453 - Base");
  }

  if (!endpoint) {
    console.log("RPC_URL not set. Exiting…");
    process.exit(1);
  }

  if (endpoint) {
    console.log("RPC_URL is set");
  }

  return new ethers.JsonRpcProvider(endpoint);
};

export const getNetworkId = (network: string): number => {
  switch (network) {
    case "ethereum":
      return 1;
    case "base":
      return 8453;
  }
  throw new Error("Invalid chainId");
};

const getNetworkName = (networkId: number): string => {
  switch (networkId) {
    case 1:
      return "ethereum";
    case 8453:
      return "base";
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
    return `${collateralSymbol}/${loanSymbol}(${formatWAD(lltv)})`;
  }
};

const formatWAD = (wad: bigint, precision = 2) => {
  return `${(Number(wad) / 1e16).toFixed(precision)}%`;
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

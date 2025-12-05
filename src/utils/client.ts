import { createPublicClient, http, PublicClient } from "viem";
import { base, mainnet, polygon, unichain, arbitrum } from "viem/chains";
import { NETWORK_TO_CHAIN_ID } from "../types/networks";

export const katana = {
  id: NETWORK_TO_CHAIN_ID.katana,
  name: "Katana",
  network: "katana",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.katana.network/"]
    },
  },
  blockExplorers: {
    default: {
      name: "KatanaScan",
      url: "https://explorer.katanarpc.com/"
    }
  },
  contracts: {
    multicall3: {
      address: "0xca11bde05977b3631167028862be2a173976ca11",
      blockCreated: 1
    }
  }
} as const;

export const monad = {
  id: NETWORK_TO_CHAIN_ID.monad,
  name: "Monad",
  network: "monad",
  nativeCurrency: {
    name: "MON",
    symbol: "MON",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: ["https://rpc-mainnet.monadinfra.com/rpc/jREsHNVkVpcEePcj7IuDA6TAB2hh1rlv"]
    },
  },
  blockExplorers: {
    default: {
      name: "MonadScan",
      url: "https://mainnet-beta.monvision.io/"
    }
  },
  contracts: {
    multicall3: {
      address: "0xca11bde05977b3631167028862be2a173976ca11",
      blockCreated: 1
    }
  }
} as const;

export async function initializeClient(chainId: number) {
  const rpcUrl =
    chainId === NETWORK_TO_CHAIN_ID.ethereum
      ? process.env.NEXT_PUBLIC_RPC_URL_MAINNET
      : chainId === NETWORK_TO_CHAIN_ID.base
      ? process.env.NEXT_PUBLIC_RPC_URL_BASE
      : chainId === NETWORK_TO_CHAIN_ID.polygon
      ? process.env.NEXT_PUBLIC_RPC_URL_POLYGON
      : chainId === NETWORK_TO_CHAIN_ID.unichain
      ? process.env.NEXT_PUBLIC_RPC_URL_UNICHAIN
      : chainId === NETWORK_TO_CHAIN_ID.arbitrum
      ? process.env.NEXT_PUBLIC_RPC_URL_ARBITRUM
      : chainId === NETWORK_TO_CHAIN_ID.katana
      ? process.env.NEXT_PUBLIC_RPC_URL_KATANA
      : chainId === NETWORK_TO_CHAIN_ID.monad
      ? process.env.NEXT_PUBLIC_RPC_URL_MONAD
      : undefined;

  if (!rpcUrl)
    throw new Error(`No RPC URL configured for chain ID: ${chainId}`);

  // Create a public client with the necessary actions
  const client = createPublicClient({
    chain:
      chainId === NETWORK_TO_CHAIN_ID.ethereum
        ? mainnet
        : chainId === NETWORK_TO_CHAIN_ID.base
        ? base
        : chainId === NETWORK_TO_CHAIN_ID.polygon
        ? polygon
        : chainId === NETWORK_TO_CHAIN_ID.unichain
        ? unichain
        : chainId === NETWORK_TO_CHAIN_ID.arbitrum
        ? arbitrum
        : chainId === NETWORK_TO_CHAIN_ID.katana
        ? katana
        : chainId === NETWORK_TO_CHAIN_ID.monad
        ? monad
        : mainnet,
    transport: http(rpcUrl, {
      batch: {
        batchSize: 100,
        wait: 20,
      },
      retryCount: 2,
    }),
    batch: {
      multicall: {
        batchSize: 1024,
        wait: 50,
      },
    },
  }) as PublicClient;
  return { client };
}

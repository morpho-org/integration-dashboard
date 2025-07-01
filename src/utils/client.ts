import { createPublicClient, http, PublicClient } from "viem";
import { base, mainnet, polygon, unichain } from "viem/chains";

export async function initializeClient(chainId: number) {
  const rpcUrl =
    chainId === 1
      ? process.env.REACT_APP_RPC_URL_MAINNET
      : chainId === 8453
      ? process.env.REACT_APP_RPC_URL_BASE
      : chainId === 137
      ? process.env.REACT_APP_RPC_URL_POLYGON
      : chainId === 130
      ? process.env.REACT_APP_RPC_URL_UNICHAIN
      : undefined;

  if (!rpcUrl)
    throw new Error(`No RPC URL configured for chain ID: ${chainId}`);

  // Create a public client with the necessary actions
  const client = createPublicClient({
    chain:
      chainId === 1
        ? mainnet
        : chainId === 8453
        ? base
        : chainId === 137
        ? polygon
        : chainId === 130
        ? unichain
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

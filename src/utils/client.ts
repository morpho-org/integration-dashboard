import { createPublicClient, http, PublicClient } from "viem";
import { base, mainnet } from "viem/chains";

export async function initializeClient(chainId: number) {
  const rpcUrl =
    chainId === 1
      ? process.env.REACT_APP_RPC_URL_MAINNET
      : chainId === 8453
      ? process.env.REACT_APP_RPC_URL_BASE
      : undefined;

  if (!rpcUrl)
    throw new Error(`No RPC URL configured for chain ID: ${chainId}`);

  // Create a public client with the necessary actions
  const client = createPublicClient({
    chain: chainId === 1 ? mainnet : chainId === 8453 ? base : mainnet,
    transport: http(rpcUrl, {
      batch: {
        batchSize: 100,
        wait: 20,
      },
      retryCount: 2,
    }),
    batch: {
      multicall: {
        batchSize: 2048,
        wait: 50,
      },
    },
  }) as PublicClient;
  return { client };
}

import { createPublicClient, http, PublicClient } from "viem";
import {
    getChainConfig,
    getRpcEnvKey,
    katana,
    monad,
    stable
} from "../config/chains";

// Re-export custom chains for backward compatibility
export { katana, monad, stable };

export async function initializeClient(chainId: number) {
  const config = getChainConfig(chainId);
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const rpcEnvKey = getRpcEnvKey(chainId);
  const rpcUrl = process.env[rpcEnvKey];

  if (!rpcUrl) {
    throw new Error(`No RPC URL configured for chain ID: ${chainId}`);
  }

  const client = createPublicClient({
    chain: config.viemChain,
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

/**
 * Viem Client Utilities
 *
 * This module provides utilities for creating blockchain clients that communicate
 * through our secure server-side RPC proxy. This keeps RPC URLs and API keys
 * on the server, never exposing them to the client-side JavaScript bundle.
 *
 * Architecture:
 * - Client makes JSON-RPC requests to /api/rpc/[chainId]
 * - Server-side API route forwards requests to actual RPC provider
 * - RPC URLs with API keys remain server-side only
 */

import { createPublicClient, http, PublicClient } from "viem";
import {
    getChainConfig,
    katana,
    monad,
    stable
} from "../config/chains";

// Re-export custom chains for backward compatibility
export { katana, monad, stable };

/**
 * Get the RPC proxy URL for a given chain ID.
 * In browser environment, uses relative URL to hit our API route.
 * This ensures RPC calls go through our secure server-side proxy.
 */
function getRpcProxyUrl(chainId: number): string {
  // Use relative URL for client-side, which will be resolved to /api/rpc/[chainId]
  // This works in both development and production environments
  if (typeof window !== "undefined") {
    return `/api/rpc/${chainId}`;
  }
  // For server-side rendering, use absolute URL
  // In production, this should be set to the actual deployment URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/api/rpc/${chainId}`;
}

/**
 * Initialize a viem PublicClient for blockchain interactions.
 *
 * The client is configured to route all RPC requests through our secure
 * server-side proxy (/api/rpc/[chainId]), which keeps the actual RPC URLs
 * and API keys hidden from the client.
 *
 * @param chainId - The blockchain network ID (e.g., 1 for Ethereum, 8453 for Base)
 * @returns An object containing the initialized PublicClient
 * @throws Error if the chain ID is not supported
 */
export async function initializeClient(chainId: number) {
  const config = getChainConfig(chainId);
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  // Use our secure RPC proxy instead of direct RPC URLs
  const rpcProxyUrl = getRpcProxyUrl(chainId);

  const client = createPublicClient({
    chain: config.viemChain,
    transport: http(rpcProxyUrl, {
      // Batching configuration for efficient RPC calls
      batch: {
        batchSize: 100,
        wait: 20,
      },
      retryCount: 2,
    }),
    batch: {
      // Multicall batching for read operations
      multicall: {
        batchSize: 1024,
        wait: 50,
      },
    },
  }) as PublicClient;

  return { client };
}

/**
 * Create a viem-compatible transport that routes through our RPC proxy.
 * This can be used with other viem utilities that need a custom transport.
 *
 * @param chainId - The blockchain network ID
 * @returns A configured HTTP transport using our RPC proxy
 */
export function createProxyTransport(chainId: number) {
  const rpcProxyUrl = getRpcProxyUrl(chainId);

  return http(rpcProxyUrl, {
    batch: {
      batchSize: 100,
      wait: 20,
    },
    retryCount: 3,
    retryDelay: 2000,
    timeout: 20000,
  });
}

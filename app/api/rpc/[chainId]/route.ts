/**
 * Server-side RPC Proxy Route
 *
 * This API route acts as a proxy for blockchain RPC calls, keeping the actual
 * RPC URLs and API keys secure on the server side. The client sends JSON-RPC
 * requests to this endpoint, and we forward them to the appropriate RPC provider.
 *
 * Security benefits:
 * - RPC URLs with API keys are never exposed to the client
 * - We can add rate limiting, logging, or filtering if needed
 * - API keys can be rotated without client-side changes
 *
 * Usage: POST /api/rpc/[chainId]
 * Body: JSON-RPC request (single or batched)
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * Mapping of chain IDs to their RPC environment variable keys.
 * These env vars should NOT have the NEXT_PUBLIC_ prefix to keep them server-only.
 */
const CHAIN_ID_TO_RPC_ENV_KEY: Record<number, string> = {
  1: "RPC_URL_MAINNET",
  10: "RPC_URL_OPTIMISM",
  8453: "RPC_URL_BASE",
  137: "RPC_URL_POLYGON",
  130: "RPC_URL_UNICHAIN",
  42161: "RPC_URL_ARBITRUM",
  747474: "RPC_URL_KATANA",
  143: "RPC_URL_MONAD",
  988: "RPC_URL_STABLE",
};

/**
 * Get the RPC URL for a given chain ID from server-side environment variables.
 * Falls back to NEXT_PUBLIC_ prefixed vars for backwards compatibility during migration.
 */
function getRpcUrl(chainId: number): string | undefined {
  const envKey = CHAIN_ID_TO_RPC_ENV_KEY[chainId];
  if (!envKey) return undefined;

  // Try server-only env var first, then fall back to public (for migration)
  return process.env[envKey] || process.env[`NEXT_PUBLIC_${envKey}`];
}

/**
 * Handles POST requests to proxy JSON-RPC calls to blockchain nodes.
 * Supports both single requests and batched requests.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chainId: string }> }
) {
  try {
    const { chainId: chainIdStr } = await params;
    const chainId = parseInt(chainIdStr, 10);

    // Validate chain ID
    if (isNaN(chainId)) {
      return NextResponse.json(
        { error: "Invalid chain ID" },
        { status: 400 }
      );
    }

    // Get RPC URL for this chain (server-side only)
    const rpcUrl = getRpcUrl(chainId);
    if (!rpcUrl) {
      return NextResponse.json(
        { error: `No RPC URL configured for chain ID: ${chainId}` },
        { status: 400 }
      );
    }

    // Parse the incoming JSON-RPC request(s)
    const body = await request.json();

    // Forward the request to the actual RPC provider
    const rpcResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    // Check if the RPC request was successful
    if (!rpcResponse.ok) {
      console.error(`RPC request failed for chain ${chainId}:`, rpcResponse.status);
      return NextResponse.json(
        { error: "RPC request failed" },
        { status: rpcResponse.status }
      );
    }

    // Return the RPC response to the client
    const data = await rpcResponse.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("RPC proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Handle OPTIONS requests for CORS preflight (if needed)
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

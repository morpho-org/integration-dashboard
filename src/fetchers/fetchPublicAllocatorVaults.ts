import type { Address, Hex } from "viem";
import { isAddress } from "viem";

export interface PublicAllocatorCandidate {
  vault: Address;
  adapter: Address;
  capId: Hex;
  absoluteCap: bigint;
  canPullFromMarket: boolean;
  canPullFromIdle: boolean;
  penalty: bigint;
}

export class PublicAllocatorVaultsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicAllocatorVaultsError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addressField(value: unknown, field: string): Address {
  if (typeof value !== "string" || !isAddress(value))
    throw new PublicAllocatorVaultsError(`Invalid ${field}: expected an address`);
  return value;
}

function uintField(value: unknown, field: string): bigint {
  if (typeof value !== "string" || !/^\d+$/.test(value))
    throw new PublicAllocatorVaultsError(
      `Invalid ${field}: expected an unsigned integer string`,
    );
  return BigInt(value);
}

function booleanField(value: unknown, field: string): boolean {
  if (typeof value !== "boolean")
    throw new PublicAllocatorVaultsError(`Invalid ${field}: expected a boolean`);
  return value;
}

/**
 * Fetch and validate the V2 allocator candidates configured for a Blue market.
 */
export async function fetchPublicAllocatorVaults(
  chainId: number,
  marketId: string,
): Promise<{
  publicAllocator: Address | null;
  items: readonly PublicAllocatorCandidate[];
}> {
  const url = `https://api.morpho.org/consumer/chains/${chainId}/markets/${marketId}/public-allocator-vaults`;
  const response = await fetch(url);
  if (!response.ok)
    throw new PublicAllocatorVaultsError(
      `Public allocator vaults request failed with HTTP ${response.status}`,
    );

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PublicAllocatorVaultsError(
      "Invalid response: expected a JSON object",
    );
  }

  if (!isRecord(payload))
    throw new PublicAllocatorVaultsError(
      "Invalid response: expected a JSON object",
    );

  const allocatorValue = payload.publicAllocator;
  const publicAllocator =
    allocatorValue === null
      ? null
      : addressField(allocatorValue, "publicAllocator");
  if (!Array.isArray(payload.items))
    throw new PublicAllocatorVaultsError("Invalid items: expected an array");

  const items = payload.items.map((item, index): PublicAllocatorCandidate => {
    const prefix = `items[${index}]`;
    if (!isRecord(item))
      throw new PublicAllocatorVaultsError(
        `Invalid ${prefix}: expected an object`,
      );
    if (
      typeof item.capId !== "string" ||
      !/^0x[a-fA-F0-9]{64}$/.test(item.capId)
    )
      throw new PublicAllocatorVaultsError(
        `Invalid ${prefix}.capId: expected a 32-byte hex string`,
      );

    return {
      vault: addressField(item.vault, `${prefix}.vault`),
      adapter: addressField(item.adapter, `${prefix}.adapter`),
      capId: item.capId as Hex,
      absoluteCap: uintField(item.absoluteCap, `${prefix}.absoluteCap`),
      canPullFromMarket: booleanField(
        item.canPullFromMarket,
        `${prefix}.canPullFromMarket`,
      ),
      canPullFromIdle: booleanField(
        item.canPullFromIdle,
        `${prefix}.canPullFromIdle`,
      ),
      penalty: uintField(item.penaltyWad, `${prefix}.penaltyWad`),
    };
  });

  return { publicAllocator, items };
}

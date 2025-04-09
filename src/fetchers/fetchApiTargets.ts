import { Address, _try } from "@morpho-org/blue-sdk";
import { fromEntries } from "@morpho-org/morpho-ts";
import { BLUE_API } from "../config/constants";
import { ApiTargetsResponse } from "../utils/types";

const MARKET_TARGETS_QUERY = `
query GetMarketTargets($chainId: Int!) {
  markets(where: { chainId_in: [$chainId] }, first: 1000) {
    items {
      id
      uniqueKey
      targetBorrowUtilization
      targetWithdrawUtilization
    }
  }
  vaults(
    where: {
      chainId_in: [$chainId]
      whitelisted: true
    }
    first: 1000
  ) {
    items {
      id
      address
      publicAllocatorConfig {
        fee
      }
    }
  }
}
`;

export async function fetchMarketTargets(chainId: number) {
  try {
    const response = await fetch(BLUE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: MARKET_TARGETS_QUERY,
        variables: { chainId },
      }),
    });

    const apiResponse = (await response.json()) as ApiTargetsResponse;

    if (!apiResponse.data?.markets?.items) {
      throw new Error("Failed to fetch market targets");
    }

    // Convert target utilizations to BigInt entries
    const supplyTargetUtilization = fromEntries(
      apiResponse.data.markets.items.map(
        ({ uniqueKey, targetBorrowUtilization }) => [
          uniqueKey,
          _try(() => BigInt(targetBorrowUtilization)),
        ]
      )
    );

    const maxWithdrawalUtilization = fromEntries(
      apiResponse.data.markets.items.map(
        ({ uniqueKey, targetWithdrawUtilization }) => [
          uniqueKey,
          _try(() => BigInt(targetWithdrawUtilization)),
        ]
      )
    );

    // Get reallocatable vaults
    const reallocatableVaults =
      apiResponse.data.vaults?.items.map(({ address }) => address as Address) ||
      [];

    return {
      supplyTargetUtilization,
      maxWithdrawalUtilization,
      reallocatableVaults,
    };
  } catch (error) {
    console.error("Error fetching market targets:", error);
    // Return empty objects as fallback
    return {
      supplyTargetUtilization: {},
      maxWithdrawalUtilization: {},
      reallocatableVaults: [],
    };
  }
}

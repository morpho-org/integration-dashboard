import { zeroAddress } from "viem";
import { AccrualPosition, Market, MarketId } from "@morpho-org/blue-sdk";
import { metaMorphoAbi, publicAllocatorAbi } from "@morpho-org/blue-sdk-viem";
import "@morpho-org/blue-sdk-viem/lib/augment";
import {
  Asset,
  FlowCaps,
  MarketData,
  MarketParams,
  Strategy,
  MarketChainData,
} from "../utils/types";
import { publicAllocatorAddress } from "../config/constants";
import { getMarketName } from "../utils/utils";
import { getReallocationData } from "../utils/maths";
import { fetchAssetData } from "./apiFetchers";
import safeAbi from "../abis/safeAbi.json";
import { Abi, PublicClient } from "viem";

export const fetchMarketParamsAndData = async (
  client: PublicClient,
  marketId: string
) => {
  const config = await Market.fetch(marketId as MarketId, client);
  const marketParams = config.params;

  const marketState = {
    totalBorrowAssets: config.totalBorrowAssets,
    totalSupplyAssets: config.totalSupplyAssets,
    totalBorrowShares: config.totalBorrowShares,
    totalSupplyShares: config.totalSupplyShares,
    lastUpdate: config.lastUpdate,
    fee: config.fee,
  };

  const marketChainData: MarketChainData = {
    marketState,
    borrowRate: config.borrowRate,
    rateAtTarget: config.rateAtTarget ?? 0n,
    apys: {
      borrowApy: config.borrowApy,
      supplyApy: config.supplyApy,
    },
  };

  return { marketParams, marketChainData };
};

export const fetchMarketParams = async (
  client: PublicClient,
  id: string
): Promise<MarketParams> => {
  try {
    const config = await Market.fetch(id as MarketId, client);
    return config.params;
  } catch (error) {
    console.error("Error fetching market params", error);
    throw error;
  }
};

export const fetchFlowCaps = async (
  vaultAddress: string,
  marketId: string,
  networkId: number,
  client: PublicClient
): Promise<FlowCaps> => {
  try {
    const caps = (await client.readContract({
      address: publicAllocatorAddress[networkId]! as `0x${string}`,
      abi: publicAllocatorAbi as Abi,
      functionName: "flowCaps",
      args: [vaultAddress, marketId],
    })) as [bigint, bigint];
    return {
      maxIn: caps[0],
      maxOut: caps[1],
    };
  } catch (error) {
    console.error("Error fetching flow caps", error);
    throw error;
  }
};

export const fetchVaultMarketPositionAndCap = async (
  client: PublicClient,
  marketId: string,
  vaultAdress: string
) => {
  const [position, supplyCap] = await Promise.all([
    AccrualPosition.fetch(
      vaultAdress as `0x${string}`,
      marketId as MarketId,
      client
    ),
    client.readContract({
      address: vaultAdress! as `0x${string}`,
      abi: metaMorphoAbi as Abi,
      functionName: "config",
      args: [marketId],
    }),
  ]);

  return { supplyAssets: position.supplyAssets, supplyCap };
};

export const getFlowCaps = async (
  vaultAddress: string,
  enabledMarkets: string[],
  networkId: number,
  client: PublicClient
) => {
  const flowCaps: { [key: string]: FlowCaps } = {};

  // Process in batches of 10 (or adjust BATCH_SIZE as needed)
  const FLOW_CAPS_BATCH_SIZE = 10;

  for (let i = 0; i < enabledMarkets.length; i += FLOW_CAPS_BATCH_SIZE) {
    const batch = enabledMarkets.slice(i, i + FLOW_CAPS_BATCH_SIZE);

    // Create multicall request
    const calls = batch.map((marketId) => ({
      address: publicAllocatorAddress[networkId]! as `0x${string}`,
      abi: publicAllocatorAbi as Abi,
      functionName: "flowCaps",
      args: [vaultAddress, marketId],
    }));

    // Execute multicall
    const results = await client.multicall({
      contracts: calls,
    });

    // Process results
    batch.forEach((marketId, index) => {
      const result = results[index];
      if (result.status === "success") {
        flowCaps[marketId] = {
          maxIn: (result.result as [bigint, bigint])[0],
          maxOut: (result.result as [bigint, bigint])[1],
        };
      } else {
        console.error(
          `Error fetching flow caps for market ${marketId}`,
          result.error
        );
        // Provide default values in case of error
        flowCaps[marketId] = {
          maxIn: 0n,
          maxOut: 0n,
        };
      }
    });

    // Add small delay between batches if needed
    if (i + FLOW_CAPS_BATCH_SIZE < enabledMarkets.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return flowCaps;
};

export const getQueuesAndChecks = async (
  vaultAddress: string,
  client: PublicClient,
  enabledMarkets: { id: string }[],
  networkId: number,
  vaultState: { owner: string; curator: string }
) => {
  // First multicall to get queue lengths
  const [{ result: withdrawQueueLength }, { result: supplyQueueLength }] =
    await client.multicall({
      contracts: [
        {
          address: vaultAddress as `0x${string}`,
          abi: metaMorphoAbi as Abi,
          functionName: "withdrawQueueLength",
        },
        {
          address: vaultAddress as `0x${string}`,
          abi: metaMorphoAbi as Abi,
          functionName: "supplyQueueLength",
        },
      ],
    });

  // Create arrays for all multicall operations
  const withdrawCalls = Array.from(
    { length: Number(withdrawQueueLength) },
    (_, i) => ({
      address: vaultAddress as `0x${string}`,
      abi: metaMorphoAbi as Abi,
      functionName: "withdrawQueue",
      args: [i],
    })
  );

  const supplyCalls = Array.from(
    { length: Number(supplyQueueLength) },
    (_, i) => ({
      address: vaultAddress as `0x${string}`,
      abi: metaMorphoAbi as Abi,
      functionName: "supplyQueue",
      args: [i],
    })
  );

  // Add flow caps calls
  const flowCapsCalls = enabledMarkets.map((market) => ({
    address: publicAllocatorAddress[networkId]! as `0x${string}`,
    abi: publicAllocatorAbi as Abi,
    functionName: "flowCaps",
    args: [vaultAddress, market.id],
  }));

  // Execute all calls in a single multicall
  const results = await client.multicall({
    contracts: [...withdrawCalls, ...supplyCalls, ...flowCapsCalls],
  });

  // Parse results
  const withdrawQueueOrder = results
    .slice(0, Number(withdrawQueueLength))
    .map((r) => r.result as string);

  const supplyQueueOrder = results
    .slice(
      Number(withdrawQueueLength),
      Number(withdrawQueueLength) + Number(supplyQueueLength)
    )
    .map((r) => r.result as string);

  // Parse flow caps results
  const flowCaps: { [key: string]: FlowCaps } = {};
  const flowCapsResults = results.slice(
    Number(withdrawQueueLength) + Number(supplyQueueLength)
  );

  enabledMarkets.forEach((market, index) => {
    const result = flowCapsResults[index];
    if (result.status === "success") {
      flowCaps[market.id] = {
        maxIn: (result.result as [bigint, bigint])[0],
        maxOut: (result.result as [bigint, bigint])[1],
      };
    } else {
      flowCaps[market.id] = {
        maxIn: 0n,
        maxOut: 0n,
      };
    }
  });

  // Add code checks for Safe contracts
  const addressesToCheck = [vaultState.owner, vaultState.curator].filter(
    Boolean
  );

  const safeResults = await checkIfSafeBatch(client, addressesToCheck);

  return {
    withdrawQueueOrder,
    supplyQueueOrder,
    flowCapsAndSafeResults: {
      flowCaps,
      safeResults,
    },
  };
};

export const getMarketParamsAndData = async (
  marketId: string,
  client: PublicClient
) => {
  const marketParams = await fetchMarketParams(client, marketId);
  return { marketParams };
};

export const getVaultMarketData = async (
  marketId: string,
  loanAsset: Asset,
  strategies: Strategy[],
  client: PublicClient
) => {
  const { marketParams, marketChainData } = await fetchMarketParamsAndData(
    client,
    marketId
  );

  const collateralAsset =
    marketParams.collateralToken === zeroAddress
      ? { address: zeroAddress, decimals: 0n, symbol: "", priceUsd: 0 }
      : await fetchAssetData(marketParams.collateralToken);

  const name = getMarketName(
    loanAsset.symbol,
    collateralAsset.symbol,
    marketParams.lltv
  );

  const strategy = strategies.find((strategy) => strategy.id === marketId);

  const marketData: MarketData = {
    id: marketId,
    name,
    marketParams,
    marketState: marketChainData.marketState,
    borrowRate: marketChainData.borrowRate,
    rateAtTarget: marketChainData.rateAtTarget ?? 0n,
    apys: marketChainData.apys,
    targetApy: strategy?.targetBorrowApy,
    targetUtilization: strategy?.utilizationTarget,
    reallocationData: getReallocationData(marketChainData, strategy),
    loanAsset,
    collateralAsset,
  };
  return marketData;
};

export async function checkIfSafeBatch(
  client: PublicClient,
  addresses: string[]
) {
  const results: { [key: string]: any } = {};
  const BATCH_SIZE = 2;
  const DELAY_BETWEEN_BATCHES = 1000;

  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE);
    console.log("checking batch: ", batch);

    const batchResults = await Promise.all(
      batch
        .filter((address) => address !== zeroAddress)
        .map(async (address) => {
          try {
            const code = await client.getCode({
              address: address as `0x${string}`,
            });

            // First check if there's code at the address
            if (code === "0x") {
              return [address, { isSafe: false }];
            }

            try {
              // Use multicall for Safe contract calls
              const [{ result: owners }, { result: threshold }] =
                await client.multicall({
                  contracts: [
                    {
                      address: address as `0x${string}`,
                      abi: safeAbi,
                      functionName: "getOwners",
                    },
                    {
                      address: address as `0x${string}`,
                      abi: safeAbi,
                      functionName: "getThreshold",
                    },
                  ],
                });

              // Additional validation to ensure it's actually a Safe
              const isSafe = Boolean(
                owners &&
                  Array.isArray(owners) &&
                  owners.length > 0 &&
                  threshold &&
                  typeof threshold === "bigint" &&
                  threshold > 0n
              );

              return [
                address,
                {
                  isSafe,
                  ...(isSafe ? { owners, threshold } : {}),
                },
              ];
            } catch (error) {
              // If multicall fails, it's not a Safe contract
              return [address, { isSafe: false }];
            }
          } catch (error) {
            console.error(`Error processing address ${address}:`, error);
            return [address, { isSafe: false }];
          }
        })
    );

    // Add batch results
    batchResults.forEach((item) => {
      const [address, result] = item as [string, any];
      results[address] = result;
    });

    // Add delay between batches
    if (i + BATCH_SIZE < addresses.length) {
      await new Promise((resolve) =>
        setTimeout(resolve, DELAY_BETWEEN_BATCHES)
      );
    }
  }

  return results;
}

// Wrapper for single address checks
export async function checkIfSafe(client: PublicClient, address: string) {
  const results = await checkIfSafeBatch(client, [address]);
  return results[address];
}

import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import {
  AccrualVaultV2MorphoMarketV1AdapterV2,
  type MarketId,
} from "@morpho-org/blue-sdk";
import type { VaultV2BlueReallocation } from "@morpho-org/morpho-sdk";
import { VaultV2BlueReallocationData } from "@morpho-org/morpho-sdk/entities";
import {
  fetchMarket,
  fetchMarketParams,
} from "@morpho-org/morpho-sdk/blue/fetch";
import { getChainAddresses } from "@morpho-org/morpho-sdk/addresses";
import { morphoViemExtension } from "@morpho-org/morpho-sdk";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  http,
  type Address,
} from "viem";
import { simulateCalls } from "viem/actions";
import { base } from "viem/chains";
import { fetchPublicAllocatorVaults } from "../src/fetchers/fetchPublicAllocatorVaults";
import { assertSimulationCallResults } from "../src/core/publicAllocatorSimulation";
import {
  getLiquidityBreakdown,
  planBorrow,
} from "../src/core/publicAllocatorPlan";
import { buildDirectAllocationTx, getPenaltyAssets } from "../src/core/publicAllocatorTx";

const chainId = base.id;
const marketId =
  (process.env.PA_FORK_MARKET_ID as MarketId | undefined) ??
  ("0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836" as MarketId);
const rpcUrl = process.env.RPC_URL_8453;
const port = 18545;
const localRpcUrl = `http://127.0.0.1:${port}`;
const user = "0x0000000000000000000000000000000000001111" as Address;

if (!rpcUrl) throw new Error("Set RPC_URL_8453 to a Base RPC endpoint.");

const anvil = spawn(
  "anvil",
  ["--fork-url", rpcUrl, "--chain-id", String(chainId), "--port", String(port)],
  { stdio: "ignore" },
);

const client = createPublicClient({
  chain: base,
  transport: http(localRpcUrl),
}).extend(morphoViemExtension());
const wallet = createWalletClient({
  account: user,
  chain: base,
  transport: http(localRpcUrl),
});

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const response = await fetch(localRpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const payload = (await response.json()) as {
    result?: T;
    error?: { message: string };
  };
  if (!response.ok || payload.error)
    throw new Error(payload.error?.message ?? `Anvil returned HTTP ${response.status}`);
  return payload.result as T;
}

async function waitForAnvil() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (anvil.exitCode !== null)
      throw new Error(`Anvil exited with code ${anvil.exitCode}.`);
    try {
      await client.getBlock();
      return;
    } catch {
      await delay(500);
    }
  }
  throw new Error("Anvil did not start listening within 30 seconds.");
}

async function stopAnvil() {
  if (anvil.exitCode !== null || anvil.signalCode !== null) return;
  anvil.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => anvil.once("exit", () => resolve())),
    delay(5000),
  ]);
}

function selectReallocations(
  data: VaultV2BlueReallocationData,
  timestamp: bigint,
  local: bigint,
  shared: bigint,
  candidates: Awaited<ReturnType<typeof fetchPublicAllocatorVaults>>["items"],
): readonly VaultV2BlueReallocation[] {
  const percentages = [5n, 10n, 25n, 50n, 75n, 90n, 99n, 100n];
  let anyPenaltyPlan: readonly VaultV2BlueReallocation[] | undefined;

  for (const percent of percentages) {
    const requested = local + (shared * percent) / 100n;
    const plan = planBorrow(data, marketId, requested, timestamp);
    if (plan.status !== "reallocations") continue;
    if (plan.reallocations.some((reallocation) => reallocation.penalty > 0n))
      anyPenaltyPlan ??= plan.reallocations;
    if (
      plan.reallocations.length >= 2 &&
      plan.reallocations.some((reallocation) => reallocation.penalty > 0n)
    )
      return plan.reallocations;
  }

  if (anyPenaltyPlan) return anyPenaltyPlan;

  for (const candidate of candidates) {
    if (
      candidate.penalty === 0n ||
      candidate.absoluteCap === 0n ||
      (!candidate.canPullFromIdle && !candidate.canPullFromMarket)
    )
      continue;

    let currentAllocation = 0n;
    try {
      currentAllocation = data.getAllocation(
        candidate.vault,
        candidate.capId,
      ).allocation;
    } catch {
      currentAllocation = 0n;
    }
    const capRemaining =
      candidate.absoluteCap > currentAllocation
        ? candidate.absoluteCap - currentAllocation
        : 0n;
    if (capRemaining === 0n) continue;

    const vault = data.getVault(candidate.vault);
    if (candidate.canPullFromIdle && vault.assetBalance > 0n) {
      const assets = [vault.assetBalance, capRemaining, 1_000_000n].reduce(
        (amount, maximum) => (amount < maximum ? amount : maximum),
      );
      if (assets === 1_000_000n)
        return [
          {
            vault: candidate.vault,
            from: { type: "idle" },
            to: { adapter: candidate.adapter },
            assets,
            penalty: candidate.penalty,
          },
        ];
    }

    if (!candidate.canPullFromMarket) continue;
    for (const adapter of vault.accrualAdapters) {
      if (!(adapter instanceof AccrualVaultV2MorphoMarketV1AdapterV2))
        continue;
      for (const sourceMarket of adapter.markets) {
        if (
          sourceMarket.id === marketId ||
          sourceMarket.params.loanToken.toLowerCase() !==
            data.getMarket(marketId).params.loanToken.toLowerCase()
        )
          continue;
        const shares = adapter.supplyShares[sourceMarket.id] ?? 0n;
        if (shares === 0n) continue;
        const sourceAssets = sourceMarket.supply(
          0n,
          shares,
          timestamp,
        ).assets;
        const assets = [
          sourceAssets,
          sourceMarket.liquidity,
          capRemaining,
          1_000_000n,
        ].reduce((amount, maximum) =>
          amount < maximum ? amount : maximum,
        );
        if (assets === 1_000_000n)
          return [
            {
              vault: candidate.vault,
              from: {
                type: "market",
                adapter: adapter.address,
                marketParams: sourceMarket.params,
              },
              to: { adapter: candidate.adapter },
              assets,
              penalty: candidate.penalty,
            },
          ];
      }
    }
  }

  throw new Error(
    "No planned positive-penalty reallocation or eligible idle/market source was found.",
  );
}

function selectMulticallReallocations(
  data: VaultV2BlueReallocationData,
  timestamp: bigint,
  candidates: Awaited<ReturnType<typeof fetchPublicAllocatorVaults>>["items"],
): readonly VaultV2BlueReallocation[] {
  const testAssets = 1_000_000n;
  const reallocations: VaultV2BlueReallocation[] = [];
  const usedCap = new Map<string, bigint>();

  for (const candidate of candidates) {
    if (
      candidate.penalty === 0n ||
      (!candidate.canPullFromIdle && !candidate.canPullFromMarket)
    )
      continue;

    const capKey = `${candidate.vault.toLowerCase()}-${candidate.capId}`;
    const capRemaining =
      candidate.absoluteCap -
      data.getAllocation(candidate.vault, candidate.capId).allocation -
      (usedCap.get(capKey) ?? 0n);
    if (capRemaining < testAssets) continue;

    const vault = data.getVault(candidate.vault);
    if (candidate.canPullFromIdle && vault.assetBalance >= testAssets) {
      reallocations.push({
        vault: candidate.vault,
        from: { type: "idle" },
        to: { adapter: candidate.adapter },
        assets: testAssets,
        penalty: candidate.penalty,
      });
      usedCap.set(capKey, (usedCap.get(capKey) ?? 0n) + testAssets);
      if (reallocations.length === 2) return reallocations;
    }

    if (!candidate.canPullFromMarket) continue;
    for (const adapter of vault.accrualAdapters) {
      if (!(adapter instanceof AccrualVaultV2MorphoMarketV1AdapterV2))
        continue;
      for (const sourceMarket of adapter.markets) {
        const shares = adapter.supplyShares[sourceMarket.id] ?? 0n;
        if (
          sourceMarket.id === marketId ||
          sourceMarket.params.loanToken.toLowerCase() !==
            data.getMarket(marketId).params.loanToken.toLowerCase() ||
          shares === 0n
        )
          continue;
        const sourceAssets = sourceMarket.supply(
          0n,
          shares,
          timestamp,
        ).assets;
        if (
          sourceAssets < testAssets ||
          sourceMarket.liquidity < testAssets ||
          candidate.absoluteCap -
            data.getAllocation(candidate.vault, candidate.capId).allocation -
            (usedCap.get(capKey) ?? 0n) <
            testAssets
        )
          continue;

        reallocations.push({
          vault: candidate.vault,
          from: {
            type: "market",
            adapter: adapter.address,
            marketParams: sourceMarket.params,
          },
          to: { adapter: candidate.adapter },
          assets: testAssets,
          penalty: candidate.penalty,
        });
        usedCap.set(capKey, (usedCap.get(capKey) ?? 0n) + testAssets);
        if (reallocations.length === 2) return reallocations;
      }
    }
  }

  throw new Error("Could not construct two positive-penalty fork reallocations.");
}

async function run() {
  await waitForAnvil();
  await rpc("anvil_setBalance", [user, "0x3635C9ADC5DEA00000"]);
  await rpc("anvil_impersonateAccount", [user]);

  const block = await client.getBlock();
  const marketParams = await fetchMarketParams(marketId, client);
  const allocatorData = await fetchPublicAllocatorVaults(chainId, marketId);
  const allocator = getChainAddresses(chainId).vaultV2BluePublicAllocator;
  if (
    allocatorData.publicAllocator !== null &&
    allocatorData.publicAllocator.toLowerCase() !== allocator?.toLowerCase()
  )
    throw new Error("Consumer API allocator did not match the Base registry.");

  const vaultAddresses = [
    ...new Map(
      allocatorData.items.map((candidate) => [
        candidate.vault.toLowerCase(),
        candidate.vault,
      ]),
    ).values(),
  ];
  const market = client.morpho.blue(marketParams, chainId);
  const data =
    vaultAddresses.length === 0
      ? new VaultV2BlueReallocationData({
          chainId,
          markets: {
            [marketId]: await fetchMarket(marketId, client, {
              blockNumber: block.number,
            }),
          },
        })
      : await market.getVaultV2BlueReallocationData({
          vaultAddresses,
          block: { number: block.number, timestamp: block.timestamp },
        });
  const liquidity = getLiquidityBreakdown(data, marketId, block.timestamp);
  const reallocations = selectReallocations(
    data,
    block.timestamp,
    liquidity.local,
    liquidity.shared,
    allocatorData.items,
  );
  const allocation = buildDirectAllocationTx(
    chainId,
    marketParams,
    reallocations,
  );
  if (allocation.penaltyAssets === 0n)
    throw new Error("Fork proof requires a positive loan-token penalty.");

  const addresses = getChainAddresses(chainId);
  const blue = addresses.blue;
  await rpc("anvil_setBalance", [blue, "0x3635C9ADC5DEA00000"]);
  await rpc("anvil_impersonateAccount", [blue]);
  const funding =
    allocation.penaltyAssets * 2n + 1_000_000n;
  const blueBalance = await client.readContract({
    address: allocation.loanToken,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [blue],
  });
  if (blueBalance < funding)
    throw new Error("Morpho Blue does not hold enough loan tokens to fund the fork proof.");
  const fundingHash = await createWalletClient({
    account: blue,
    chain: base,
    transport: http(localRpcUrl),
  }).writeContract({
    address: allocation.loanToken,
    abi: erc20Abi,
    functionName: "transfer",
    args: [user, funding],
  });
  const fundingReceipt = await client.waitForTransactionReceipt({
    hash: fundingHash,
  });
  if (fundingReceipt.status !== "success")
    throw new Error("Failed to fund the fork test wallet.");

  const approvalHash = await wallet.writeContract({
    address: allocation.loanToken,
    abi: erc20Abi,
    functionName: "approve",
    args: [allocation.allocator, allocation.penaltyAssets],
  });
  const approvalReceipt = await client.waitForTransactionReceipt({
    hash: approvalHash,
  });
  if (approvalReceipt.status !== "success")
    throw new Error("Failed to approve the exact penalty amount.");

  const incorrectPenaltyReallocations = reallocations.map(
    (reallocation, index) =>
      index === 0
        ? { ...reallocation, penalty: reallocation.penalty + 1n }
        : reallocation,
  ) as readonly VaultV2BlueReallocation[];
  const incorrectPenaltyTx = buildDirectAllocationTx(
    chainId,
    marketParams,
    incorrectPenaltyReallocations,
  );
  let incorrectPenaltyReverted = false;
  try {
    await client.call({
      account: user,
      to: incorrectPenaltyTx.tx.to,
      data: incorrectPenaltyTx.tx.data,
      value: 0n,
    });
  } catch {
    incorrectPenaltyReverted = true;
  }
  if (!incorrectPenaltyReverted)
    throw new Error("The allocation unexpectedly accepted an incorrect penalty.");

  try {
    await client.call({
      account: user,
      to: allocation.tx.to,
      data: allocation.tx.data,
      value: 0n,
    });
  } catch (error) {
    throw new Error(
      `Direct V2 allocation preflight failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const marketBefore = await fetchMarket(marketId, client);
  const vaultPenaltyBefore = new Map<string, bigint>();
  for (const vaultAddress of vaultAddresses)
    vaultPenaltyBefore.set(
      vaultAddress.toLowerCase(),
      await client.readContract({
        address: allocation.loanToken,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [vaultAddress],
      }),
    );
  const expectedSupplyIncrease = reallocations.reduce(
    (sum, reallocation) => sum + reallocation.assets,
    0n,
  );

  const allocationHash = await wallet.sendTransaction({
    to: allocation.tx.to,
    data: allocation.tx.data,
    value: 0n,
  });
  const allocationReceipt = await client.waitForTransactionReceipt({
    hash: allocationHash,
  });
  if (allocationReceipt.status !== "success")
    throw new Error("Direct V2 allocation transaction failed.");

  const allocationBlock = await client.getBlock({
    blockNumber: allocationReceipt.blockNumber,
  });
  const marketAfter = await fetchMarket(marketId, client);
  const supplyBeforeAtAllocation = marketBefore
    .accrueInterest(allocationBlock.timestamp)
    .totalSupplyAssets;
  const supplyIncrease =
    marketAfter.totalSupplyAssets - supplyBeforeAtAllocation;
  if (supplyIncrease !== expectedSupplyIncrease)
    throw new Error(
      `Target supply changed by ${supplyIncrease}, expected ${expectedSupplyIncrease}.`,
    );

  const penaltyIncrease = new Map<string, bigint>();
  for (const reallocation of reallocations) {
    const vaultKey = reallocation.vault.toLowerCase();
    const previous = penaltyIncrease.get(vaultKey) ?? 0n;
    penaltyIncrease.set(
      vaultKey,
      previous + getPenaltyAssets(reallocation),
    );
  }
  for (const [vaultKey, expectedPenalty] of penaltyIncrease) {
    const vaultAddress = vaultKey as Address;
    const after = await client.readContract({
      address: allocation.loanToken,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [vaultAddress],
    });
    const before = vaultPenaltyBefore.get(vaultKey) ?? 0n;
    if (after - before !== expectedPenalty)
      throw new Error(
        `Vault ${vaultAddress} penalty balance changed by ${after - before}, expected ${expectedPenalty}.`,
      );
  }

  const tokenDecimals = await client.readContract({
    address: allocation.loanToken,
    abi: erc20Abi,
    functionName: "decimals",
  });
  console.log(`forkBlock=${block.number}`);
  console.log(`marketId=${marketId}`);
  console.log(`candidates=${allocatorData.items.length}`);
  console.log(`reallocations=${reallocations.length}`);
  console.log(
    `assets=${formatUnits(expectedSupplyIncrease, tokenDecimals)} loan tokens`,
  );
  console.log(
    `penaltyAssets=${formatUnits(allocation.penaltyAssets, tokenDecimals)} loan tokens`,
  );
  console.log(`transactionValue=${allocation.tx.value}`);
  console.log(`wrongPenalty=reverted`);
  console.log(`targetSupplyIncrease=${supplyIncrease}`);
  console.log(`penaltyBalances=increased by configured per-vault totals`);
  console.log(`receipt=${allocationReceipt.status} ${allocationHash}`);

  const multicallBlock = await client.getBlock();
  const multicallData = await market.getVaultV2BlueReallocationData({
    vaultAddresses,
    block: {
      number: multicallBlock.number,
      timestamp: multicallBlock.timestamp,
    },
  });
  const multicallReallocations = selectMulticallReallocations(
    multicallData,
    multicallBlock.timestamp,
    allocatorData.items,
  );
  const multicallAllocation = buildDirectAllocationTx(
    chainId,
    marketParams,
    multicallReallocations,
  );
  if (multicallAllocation.penaltyAssets === 0n)
    throw new Error("Multicall fork proof requires a positive penalty.");

  const userBalance = await client.readContract({
    address: multicallAllocation.loanToken,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [user],
  });
  if (userBalance < multicallAllocation.penaltyAssets) {
    const extraFunding =
      multicallAllocation.penaltyAssets - userBalance + 1n;
    const fundHash = await createWalletClient({
      account: blue,
      chain: base,
      transport: http(localRpcUrl),
    }).writeContract({
      address: multicallAllocation.loanToken,
      abi: erc20Abi,
      functionName: "transfer",
      args: [user, extraFunding],
    });
    const fundReceipt = await client.waitForTransactionReceipt({
      hash: fundHash,
    });
    if (fundReceipt.status !== "success")
      throw new Error("Failed to fund the multicall penalty.");
  }

  const penaltyApproval = {
    to: multicallAllocation.loanToken,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [
        multicallAllocation.allocator,
        multicallAllocation.penaltyAssets,
      ],
    }),
  };
  const allocationCall = {
    to: multicallAllocation.tx.to,
    data: multicallAllocation.tx.data,
    value: 0n,
  } as const;
  const simulation = await simulateCalls(client, {
    account: user,
    calls: [penaltyApproval, allocationCall],
  });
  assertSimulationCallResults(simulation.results, [
    "Penalty approval",
    "Reallocation",
  ]);
  if (simulation.results.some((result) => result.status !== "success"))
    throw new Error("Correct multicall simulation did not fully succeed.");

  const wrongPenaltyReallocations = multicallReallocations.map(
    (reallocation, index) =>
      index === 1
        ? { ...reallocation, penalty: reallocation.penalty + 1n }
        : reallocation,
  ) as readonly VaultV2BlueReallocation[];
  const wrongPenaltyAllocation = buildDirectAllocationTx(
    chainId,
    marketParams,
    wrongPenaltyReallocations,
  );
  const wrongPenaltySimulation = await simulateCalls(client, {
    account: user,
    calls: [
      penaltyApproval,
      {
        to: wrongPenaltyAllocation.tx.to,
        data: wrongPenaltyAllocation.tx.data,
        value: 0n,
      },
    ],
  });
  if (wrongPenaltySimulation.results[0].status !== "success")
    throw new Error("Penalty approval failed in wrong-penalty simulation.");
  if (wrongPenaltySimulation.results[1].status !== "failure")
    throw new Error("Wrong-penalty multicall simulation did not report failure.");
  let simulatorFailureMessage = "";
  try {
    assertSimulationCallResults(wrongPenaltySimulation.results, [
      "Penalty approval",
      "Reallocation",
    ]);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Reallocation failed:")
    )
      simulatorFailureMessage = error.message;
  }
  if (!simulatorFailureMessage)
    throw new Error("Simulator did not identify the failed reallocation step.");

  for (let index = 0; index < multicallReallocations.length; index += 1) {
    const incorrect = multicallReallocations.map((reallocation, entryIndex) =>
      entryIndex === index
        ? { ...reallocation, penalty: reallocation.penalty + 1n }
        : reallocation,
    ) as readonly VaultV2BlueReallocation[];
    const incorrectTx = buildDirectAllocationTx(
      chainId,
      marketParams,
      incorrect,
    );
    let reverted = false;
    try {
      await client.call({
        account: user,
        to: incorrectTx.tx.to,
        data: incorrectTx.tx.data,
        value: 0n,
      });
    } catch {
      reverted = true;
    }
    if (!reverted)
      throw new Error(`Wrong penalty in multicall entry ${index} did not revert.`);
  }
  if (multicallAllocation.tx.value !== 0n)
    throw new Error("Multicall allocation unexpectedly requires native value.");

  const multicallApprovalHash = await wallet.writeContract({
    address: multicallAllocation.loanToken,
    abi: erc20Abi,
    functionName: "approve",
    args: [multicallAllocation.allocator, multicallAllocation.penaltyAssets],
  });
  const multicallApprovalReceipt = await client.waitForTransactionReceipt({
    hash: multicallApprovalHash,
  });
  if (multicallApprovalReceipt.status !== "success")
    throw new Error("Failed to approve the multicall penalty.");
  await client.call({
    account: user,
    to: multicallAllocation.tx.to,
    data: multicallAllocation.tx.data,
    value: 0n,
  });

  const multicallMarketBefore = await fetchMarket(marketId, client);
  const multicallVaults = [
    ...new Set(multicallReallocations.map((item) => item.vault.toLowerCase())),
  ] as Address[];
  const multicallPenaltyBefore = new Map<string, bigint>();
  for (const vaultAddress of multicallVaults)
    multicallPenaltyBefore.set(
      vaultAddress.toLowerCase(),
      await client.readContract({
        address: multicallAllocation.loanToken,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [vaultAddress],
      }),
    );
  const multicallExpectedSupply = multicallReallocations.reduce(
    (sum, reallocation) => sum + reallocation.assets,
    0n,
  );
  const multicallHash = await wallet.sendTransaction({
    to: multicallAllocation.tx.to,
    data: multicallAllocation.tx.data,
    value: 0n,
  });
  const multicallReceipt = await client.waitForTransactionReceipt({
    hash: multicallHash,
  });
  if (multicallReceipt.status !== "success")
    throw new Error("Direct multicall allocation transaction failed.");

  const multicallReceiptBlock = await client.getBlock({
    blockNumber: multicallReceipt.blockNumber,
  });
  const multicallMarketAfter = await fetchMarket(marketId, client);
  const multicallSupplyIncrease =
    multicallMarketAfter.totalSupplyAssets -
    multicallMarketBefore
      .accrueInterest(multicallReceiptBlock.timestamp)
      .totalSupplyAssets;
  if (multicallSupplyIncrease !== multicallExpectedSupply)
    throw new Error(
      `Multicall target supply changed by ${multicallSupplyIncrease}, expected ${multicallExpectedSupply}.`,
    );

  const multicallExpectedPenalties = new Map<string, bigint>();
  for (const reallocation of multicallReallocations) {
    const vaultKey = reallocation.vault.toLowerCase();
    multicallExpectedPenalties.set(
      vaultKey,
      (multicallExpectedPenalties.get(vaultKey) ?? 0n) +
        getPenaltyAssets(reallocation),
    );
  }
  for (const [vaultKey, expectedPenalty] of multicallExpectedPenalties) {
    const actualBalance = await client.readContract({
      address: multicallAllocation.loanToken,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [vaultKey as Address],
    });
    const previousBalance = multicallPenaltyBefore.get(vaultKey) ?? 0n;
    if (actualBalance - previousBalance !== expectedPenalty)
      throw new Error(
        `Multicall vault ${vaultKey} penalty balance changed by ${actualBalance - previousBalance}, expected ${expectedPenalty}.`,
      );
  }
  console.log(`entries=${multicallReallocations.length}`);
  console.log("multicall=true");
  console.log(`multicallAssets=${multicallExpectedSupply}`);
  console.log(`multicallPenaltyAssets=${multicallAllocation.penaltyAssets}`);
  console.log(`multicallTransactionValue=${multicallAllocation.tx.value}`);
  console.log("multicallWrongPenalty=reverted for entries=0,1");
  console.log("simulateCalls=all-success");
  console.log(`simulateCallsWrongPenalty=${simulatorFailureMessage}`);
  console.log(`multicallTargetSupplyIncrease=${multicallSupplyIncrease}`);
  console.log("multicallPenaltyBalances=increased by per-vault totals");
  console.log(`multicallReceipt=${multicallReceipt.status} ${multicallHash}`);
}

run()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message.replaceAll(rpcUrl, "<redacted-rpc-url>"));
    process.exitCode = 1;
  })
  .finally(stopAnvil);

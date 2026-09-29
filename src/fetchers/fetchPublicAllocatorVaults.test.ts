import { afterEach, describe, expect, test, vi } from "vitest";
import {
  fetchPublicAllocatorVaults,
  PublicAllocatorVaultsError,
} from "./fetchPublicAllocatorVaults";

const address = "0x0000000000000000000000000000000000000001";
const item = {
  vault: address,
  adapter: address,
  capId: `0x${"a".repeat(64)}`,
  absoluteCap: "123456",
  canPullFromMarket: true,
  canPullFromIdle: false,
  penaltyWad: "100000000000000",
};

function mockResponse(
  payload: unknown,
  status = 200,
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchPublicAllocatorVaults", () => {
  test("validates and parses candidate values", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse({ publicAllocator: address, items: [item] }),
      ),
    );

    await expect(
      fetchPublicAllocatorVaults(8453, `0x${"b".repeat(64)}`),
    ).resolves.toEqual({
      publicAllocator: address,
      items: [
        {
          vault: address,
          adapter: address,
          capId: item.capId,
          absoluteCap: 123456n,
          canPullFromMarket: true,
          canPullFromIdle: false,
          penalty: 100000000000000n,
        },
      ],
    });
  });

  test("accepts an empty candidate list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse({ publicAllocator: null, items: [] }),
      ),
    );

    await expect(fetchPublicAllocatorVaults(1, `0x${"c".repeat(64)}`)).resolves
      .toEqual({ publicAllocator: null, items: [] });
  });

  test("reports non-success HTTP responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse({}, 503)),
    );

    await expect(fetchPublicAllocatorVaults(1, `0x${"c".repeat(64)}`)).rejects
      .toThrow(/HTTP 503/);
  });

  test("rejects malformed addresses and unsigned integer strings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse({
          publicAllocator: null,
          items: [{ ...item, vault: "not-an-address" }],
        }),
      ),
    );
    await expect(fetchPublicAllocatorVaults(1, `0x${"c".repeat(64)}`)).rejects
      .toBeInstanceOf(PublicAllocatorVaultsError);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse({
          publicAllocator: null,
          items: [{ ...item, absoluteCap: "-1" }],
        }),
      ),
    );
    await expect(fetchPublicAllocatorVaults(1, `0x${"c".repeat(64)}`)).rejects
      .toThrow(/absoluteCap/);
  });
});

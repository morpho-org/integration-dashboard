import { Provider } from "ethers";
import { PublicAllocator__factory } from "ethers-types";
import { FlowCaps } from "../utils/types";
import { publicAllocatorAddress } from "../config/constants";

export const fetchFlowCaps = async (
  vaultAddress: string,
  marketId: string,
  networkId: number,
  provider: Provider
): Promise<FlowCaps> => {
  const publicAllocator = PublicAllocator__factory.connect(
    publicAllocatorAddress[networkId]!,
    provider
  );

  try {
    const caps = await publicAllocator.flowCaps(vaultAddress, marketId);
    return { maxIn: caps[0], maxOut: caps[1] };
  } catch (error) {
    throw error;
  }
};

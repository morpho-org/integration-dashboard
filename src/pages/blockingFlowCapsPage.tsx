import React, { useEffect, useState } from "react";
import { BlockingFlowCaps, VaultWithBlockingFlowCaps } from "../utils/types";
import {
  HeaderWrapper,
  PageWrapper,
  TitleContainer,
  VaultsWrapper,
} from "./wrappers";
import VaultWithBlockingFlowCapsBubble from "../components/VaultWithBlockingFlowCaps";
import { fetchBlockingFlowCaps } from "../fetchers/apiFetchers";
import { extractIdFromUrl, getNetworkId, getProvider } from "../utils/utils";

import styled from "styled-components";
import { Provider } from "ethers";
import { PublicAllocator__factory } from "ethers-types";
import { publicAllocatorAddress } from "../config/constants";
import { MulticallWrapper } from "ethers-multicall-provider";

// Add these styled components
const SearchWrapper = styled.div`
  position: relative;
  width: 400px;
`;

const SearchInput = styled.input`
  width: 100%;
  height: 40px;
  padding: 8px 16px 8px 48px;
  border-radius: 9999px;
  background: rgba(250, 250, 250, 0.1);
  color: white;
  font-size: 0.875rem;
  outline: none;

  &::placeholder {
    color: #a0a0a0;
  }

  &:focus {
    box-shadow: 0 0 0 2px #2973ff;
  }
`;

const SearchIcon = styled.svg`
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
`;

const CuratorFilterSelect = styled.select`
  width: 100%;
  max-width: 200px;
  height: 40px;
  padding: 8px 16px;
  border-radius: 9999px;
  background: rgba(250, 250, 250, 0.1);
  color: white;
  font-size: 0.875rem;
  border: none;
  outline: none;
  margin-left: 10px;
  &:focus {
    box-shadow: 0 0 0 2px #2973ff;
  }

  appearance: none;
  background-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="%23FFFFFF"><path d="M7 10l5 5 5-5H7z"/></svg>');
  background-repeat: no-repeat;
  background-position: right 16px center;
  background-size: 16px;
`;

type BlockingFlowCapsPageProps = {
  network: "ethereum" | "base";
};

const BlockingFlowCapsPage: React.FC<BlockingFlowCapsPageProps> = ({
  network,
}) => {
  const [vaults, setVaults] = useState<VaultWithBlockingFlowCaps[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [curatorFilter, setCuratorFilter] = useState<string>("");

  const fetchData = async (network: "ethereum" | "base") => {
    setLoading(true);
    setError(null);
    try {
      const blockingFlowCaps = await fetchBlockingFlowCaps(
        getNetworkId(network)
      );
      setVaults(
        groupByVault(
          await removeOpenFlowCaps(blockingFlowCaps, getNetworkId(network))
        )
      );
    } catch (err) {
      setError("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(network);
  }, [network]);

  const allCurators = vaults
    .flatMap((vault) => vault.vault.curators)
    .filter((value, index, self) => self.indexOf(value) === index);

  const filterByCurator = (vault: VaultWithBlockingFlowCaps) => {
    if (curatorFilter === "") return true;
    return vault.vault.curators.includes(curatorFilter);
  };

  const filteredVaults = vaults
    .filter(
      (vault) =>
        vault.vault.underlyingAsset.symbol
          .toLowerCase()
          .includes(filter.toLowerCase()) ||
        vault.vault.address.toLowerCase().includes(filter.toLowerCase())
    )
    .filter(filterByCurator);

  return (
    <PageWrapper>
      <HeaderWrapper>
        <TitleContainer>
          <h1 style={{ color: "white", fontWeight: "300" }}>
            Vaults With Blocking Flow Caps
          </h1>
        </TitleContainer>
        <div
          style={{ display: "flex", alignItems: "center", marginTop: "10px" }}
        >
          <SearchWrapper>
            <SearchInput
              type="text"
              placeholder="Search by asset or address..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <SearchIcon
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M17.3813 19.6187C17.723 19.9604 18.277 19.9604 18.6187 19.6187C18.9604 19.277 18.9604 18.723 18.6187 18.3813L17.3813 19.6187ZM13.3813 15.6187L17.3813 19.6187L18.6187 18.3813L14.6187 14.3813L13.3813 15.6187Z"
                fill="url(#paint0_linear_32_2985)"
              />
              <circle
                cx="10"
                cy="11"
                r="6"
                stroke="url(#paint1_linear_32_2985)"
                strokeWidth="1.75"
              />
              <defs>
                <linearGradient
                  id="paint0_linear_32_2985"
                  x1="15.9998"
                  y1="15"
                  x2="15.9998"
                  y2="19"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#2470FF" />
                  <stop offset="1" stopColor="#5792FF" />
                </linearGradient>
                <linearGradient
                  id="paint1_linear_32_2985"
                  x1="9.99927"
                  y1="5"
                  x2="9.9993"
                  y2="17"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#2470FF" />
                  <stop offset="1" stopColor="#5792FF" />
                </linearGradient>
              </defs>
            </SearchIcon>
          </SearchWrapper>
          <CuratorFilterSelect
            value={curatorFilter}
            onChange={(e) => setCuratorFilter(e.target.value)}
          >
            <option value="">All Curators</option>
            {allCurators.map((curator, index) => (
              <option key={index} value={curator}>
                {curator}
              </option>
            ))}
          </CuratorFilterSelect>
        </div>
      </HeaderWrapper>
      {loading && <p style={{ color: "white" }}>Loading...</p>}
      {error && <p style={{ color: "white" }}>{error}</p>}
      <VaultsWrapper>
        {filteredVaults.map((vault) => (
          <VaultWithBlockingFlowCapsBubble
            key={vault.vault.link.name}
            vaultWithBlockingFlowCaps={vault}
          />
        ))}
      </VaultsWrapper>
    </PageWrapper>
  );
};

const groupByVault = (
  blockingFlowCaps: BlockingFlowCaps[]
): VaultWithBlockingFlowCaps[] => {
  const acc: Record<string, VaultWithBlockingFlowCaps> = {};

  for (const item of blockingFlowCaps) {
    if (!acc[item.vault.address]) {
      acc[item.vault.address] = { vault: item.vault, blockingFlowCaps: [] };
    }
    acc[item.vault.address].blockingFlowCaps.push(item);
  }

  return Object.values(acc);
};

const removeOpenFlowCaps = async (
  blockingFlowCaps: BlockingFlowCaps[],
  networkId: number
) => {
  const provider = MulticallWrapper.wrap(getProvider(networkId));

  return await Promise.all(
    blockingFlowCaps.filter(
      async (blockingFlowCap) =>
        await isOpen(blockingFlowCap, networkId, provider)
    )
  );
};

const isOpen = async (
  blockingFlowCap: BlockingFlowCaps,
  networkId: number,
  provider: Provider
) => {
  const publicAllocator = PublicAllocator__factory.connect(
    publicAllocatorAddress[networkId]!,
    provider
  );

  const flowCaps = await publicAllocator.flowCaps(
    blockingFlowCap.vault.address,
    extractIdFromUrl(blockingFlowCap.market.url)
  );

  const maxInOpen = blockingFlowCap.maxIn
    ? flowCaps.maxIn >= blockingFlowCap.maxIn
    : true;

  const maxOutOpen = blockingFlowCap.maxOut
    ? flowCaps.maxOut >= blockingFlowCap.maxOut
    : true;

  return maxInOpen && maxOutOpen;
};

export default BlockingFlowCapsPage;

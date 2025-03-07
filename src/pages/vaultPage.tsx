import React, { useEffect, useState } from "react";
import WithdrawQueueBubble from "../components/WithdrawQueueBubble";
import SupplyQueueBubble from "../components/SupplyQueueBubble";
import VaultFlowCapsBubble from "../components/VaultFlowCapsBubble";
import { VaultData } from "../utils/types";
import { getVaultDisplayData } from "../core/vaultData";
import { formatUsdAmount, getNetworkId } from "../utils/utils";
import styled from "styled-components";
import {
  HeaderWrapper,
  PageWrapper,
  TitleContainer,
  VaultsWrapper,
} from "./wrappers";
import {
  Copy,
  CopyCheck,
  ChevronDown,
  ChevronUp,
  EyeOff,
  Eye,
} from "lucide-react";

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

const FilterSelect = styled.select`
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

const TableHeader = styled.div`
  display: grid;
  grid-template-columns: 1fr 0.5fr 0.5fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
  gap: 10px;
  padding: 10px;
  background-color: #1e2124;
  color: white;
  font-weight: bold;
  border-radius: 8px;
  margin-bottom: 10px;
`;

const VaultRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 0.5fr 0.5fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
  gap: 10px;
  padding: 10px;
  background-color: #2c2f33;
  color: white;
  border-radius: 8px;
  margin-bottom: 5px;
  cursor: pointer;

  &:hover {
    background-color: #34383c;
  }

  align-items: center;
`;

const WarningText = styled.span`
  color: #c93333;
`;

const ExpandedContent = styled.div`
  grid-column: 1 / -1;
  background-color: #34383c;
  padding: 15px;
  border-radius: 0 0 8px 8px;
  margin-top: -5px;
`;

const BubbleContainer = styled.div`
  display: flex;
  justify-content: space-evenly;
  align-items: flex-start;
  margin-top: 10px;
  width: 100%;
`;

const AddressText = styled.span`
  font-family: monospace;
  font-size: 0.85em;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;

  &:hover {
    color: #2973ff;
  }
`;

const VaultNameLink = styled.a`
  color: white;
  text-decoration: none;

  &:hover {
    color: #2973ff;
    text-decoration: underline;
  }
`;

const YellowText = styled.span`
  color: #ffa500; // Using orange to distinguish from error state
`;

// Add this new styled component for blinking text
const BlinkingAddressText = styled(AddressText)`
  animation: blink 1s ease-in-out infinite;

  @keyframes blink {
    0%,
    100% {
      color: white;
    }
    50% {
      color: #c93333;
    }
  }
`;

// Add this new styled component for the hide/show button
const HideButton = styled.button`
  background: transparent;
  border: none;
  color: #a0a0a0;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
`;

const formatUsdWithStyle = (amount: string, color?: string) => {
  const [dollars, cents] = amount.split(".");
  return (
    <span style={{ color: color || "#2973FF" }}>
      {dollars}
      <span style={{ color: "rgba(255, 255, 255, 0.5)" }}>.{cents}</span>
    </span>
  );
};

type VaultPageProps = {
  network: "ethereum" | "base";
};

const VaultPage: React.FC<VaultPageProps> = ({ network }) => {
  const [vaults, setVaults] = useState<VaultData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [warningFilter, setWarningFilter] = useState<string>("");
  const [curatorFilter, setCuratorFilter] = useState<string>("");
  const [versionFilter, setVersionFilter] = useState<string>("");
  const [whitelistFilter, setWhitelistFilter] = useState<string>("all");
  const [hiddenVaults, setHiddenVaults] = useState<string[]>([]);
  const [showHiddenVaults, setShowHiddenVaults] = useState<boolean>(false);

  const [expandedVault, setExpandedVault] = useState<string | null>(null);

  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Load hidden vaults from localStorage on initial render
  useEffect(() => {
    const savedHiddenVaults = localStorage.getItem("hiddenVaults");
    if (savedHiddenVaults) {
      setHiddenVaults(JSON.parse(savedHiddenVaults));
    }
  }, []);

  // Save hidden vaults to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("hiddenVaults", JSON.stringify(hiddenVaults));
  }, [hiddenVaults]);

  const handleCopy = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const fetchData = async (
    network: "ethereum" | "base",
    whitelistOption: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      const networkId = getNetworkId(network);
      let data: VaultData[] = [];

      if (whitelistOption === "all") {
        // Fetch both whitelisted and non-whitelisted vaults
        const [whitelistedVaults, nonWhitelistedVaults] = await Promise.all([
          getVaultDisplayData(networkId, true), // Whitelisted vaults
          getVaultDisplayData(networkId, false), // Non-whitelisted vaults
        ]);
        // Combine the results
        data = [...whitelistedVaults, ...nonWhitelistedVaults];
      } else {
        // Either "whitelisted" or "not-whitelisted"
        const isWhitelistedOnly = whitelistOption === "whitelisted";
        data = await getVaultDisplayData(networkId, isWhitelistedOnly);
      }

      // Filter out any malformed vault data
      const validVaults = data.filter((vault) => {
        try {
          // Basic validation that required properties exist
          return vault && vault.vault && vault.vault.asset;
        } catch (e) {
          console.warn("Skipping malformed vault data:", vault);
          return false;
        }
      });
      setVaults(validVaults);
      if (validVaults.length < data.length) {
        setError(
          "Some vaults could not be loaded completely but displaying available data"
        );
      }
    } catch (err) {
      console.error("Error fetching vault data", err);
      setError("Some data failed to load but displaying available vaults");
      // Don't clear existing vaults, keep showing what we have
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  useEffect(() => {
    setVaults([]);
    setError(null);
    fetchData(network, whitelistFilter);
  }, [network, whitelistFilter]);

  const allCurators = vaults
    .flatMap((vault) => vault.curators)
    .filter((value, index, self) => self.indexOf(value) === index);

  const toggleHideVault = (vaultAddress: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHiddenVaults((prevHiddenVaults) => {
      if (prevHiddenVaults.includes(vaultAddress)) {
        return prevHiddenVaults.filter((addr) => addr !== vaultAddress);
      } else {
        return [...prevHiddenVaults, vaultAddress];
      }
    });
  };

  const filterByWarning = (vault: VaultData) => {
    switch (warningFilter) {
      case "NotWhitelisted":
        return !vault.isWhitelisted;
      case "WrongWithdrawQueue":
        return vault.warnings?.idlePositionWithdrawQueue === true;
      case "WrongSupplyQueue":
        return vault.warnings?.idlePositionSupplyQueue === true;
      case "MissingFlowCaps":
        return vault.warnings?.missingFlowCaps === true;
      case "WrongPublicAllocator":
        return !vault.publicAllocatorIsAllocator;
      case "OwnerNotSafe":
        return !vault.ownerSafeDetails.isSafe;
      case "CuratorNotSafe":
        // Check if curator exists (not zero address) and is not a safe
        return (
          vault.curator !== "0x0000000000000000000000000000000000000000" &&
          !vault.curatorSafeDetails?.isSafe
        );
      default:
        return true;
    }
  };

  const filterByCurator = (vault: VaultData) => {
    if (curatorFilter === "") return true;
    return vault.curators.includes(curatorFilter);
  };

  const filteredVaults = vaults
    .filter(
      (vault) =>
        vault.vault.asset.symbol.toLowerCase().includes(filter.toLowerCase()) ||
        vault.vault.address.toLowerCase().includes(filter.toLowerCase())
    )
    .filter(filterByWarning)
    .filter(filterByCurator)
    .filter((vault) => {
      switch (versionFilter) {
        case "v1.1":
          return vault.isV1_1;
        case "v0":
          return !vault.isV1_1;
        default:
          return true;
      }
    })
    .filter((vault) => {
      // Only show hidden vaults when the toggle is on
      if (showHiddenVaults) {
        return true;
      } else {
        return !hiddenVaults.includes(vault.vault.address);
      }
    });

  const toggleExpand = (vaultAddress: string) => {
    setExpandedVault(expandedVault === vaultAddress ? null : vaultAddress);
  };

  const getFlowCapsStatus = (vault: VaultData) => {
    if (vault.warnings?.allCapsTo0) {
      return <WarningText>Not Configured</WarningText>;
    }

    if (!vault.warnings?.missingFlowCaps) {
      return "OK";
    }

    if (vault.warnings?.missingFlowCaps) {
      return <YellowText>Misconfigured</YellowText>;
    }
  };

  return (
    <PageWrapper>
      <HeaderWrapper>
        <TitleContainer>
          <h1 style={{ color: "white", fontWeight: "300" }}>Morpho Vaults</h1>
          <h2 style={{ color: "white", fontWeight: "200" }}>
            Number of vaults: {filteredVaults.length}
          </h2>
          <h2 style={{ color: "white", fontWeight: "200" }}>
            Total Deposit:{" "}
            {formatUsdWithStyle(
              formatUsdAmount(
                filteredVaults.reduce(
                  (acc, vault) => acc + vault.vault.totalAssetsUsd,
                  0
                )
              )
            )}
          </h2>
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
          <FilterSelect
            value={versionFilter}
            onChange={(e) => setVersionFilter(e.target.value)}
          >
            <option value="">v1.0 & v1.1</option>
            <option value="v1.1">v1.1</option>
            <option value="v0">v0</option>
          </FilterSelect>
          <FilterSelect
            value={warningFilter}
            onChange={(e) => setWarningFilter(e.target.value)}
          >
            <option value="">All Vaults</option>
            <option value="NotWhitelisted">Not Whitelisted</option>
            <option value="WrongWithdrawQueue">Wrong Withdraw Queue</option>
            <option value="WrongSupplyQueue">Wrong Supply Queue</option>
            <option value="MissingFlowCaps">Missing Flow Caps</option>
            <option value="WrongPublicAllocator">
              Public Allocator missing
            </option>
            <option value="OwnerNotSafe">Owner Not Safe</option>
            <option value="CuratorNotSafe">Curator Not Safe</option>
          </FilterSelect>
          <FilterSelect
            value={curatorFilter}
            onChange={(e) => setCuratorFilter(e.target.value)}
          >
            <option value="">All Curators</option>
            {allCurators.map((curator, index) => (
              <option key={index} value={curator}>
                {curator}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            value={whitelistFilter}
            onChange={(e) => setWhitelistFilter(e.target.value)}
          >
            <option value="all">All Vaults</option>
            <option value="whitelisted">Whitelisted Only</option>
            <option value="not-whitelisted">Not Whitelisted Only</option>
          </FilterSelect>
          <div
            style={{
              marginLeft: "10px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <label
              style={{
                color: "white",
                marginRight: "5px",
                fontSize: "0.875rem",
              }}
            >
              Show hidden vaults:
            </label>
            <input
              type="checkbox"
              checked={showHiddenVaults}
              onChange={() => setShowHiddenVaults((prev) => !prev)}
              style={{ cursor: "pointer" }}
            />
          </div>
        </div>
      </HeaderWrapper>
      {loading && (
        <p style={{ color: "white" }}>Loading needs beetwen 3 to 10 seconds</p>
      )}
      {error && <p style={{ color: "white" }}>{error}</p>}
      <TableHeader
        style={{
          background: "transparent",
          color: "#2973FF",
          marginTop: "30px",
        }}
      >
        <div>Vault Name</div>
        <div>Version</div>
        <div>Timelock (Days)</div>
        <div>Total Assets</div>
        <div>Withdraw Queue</div>
        <div>Supply Queue</div>
        <div>Public Allocator</div>
        <div>Flow Caps</div>
        <div>Owner</div>
        <div>Curator</div>
      </TableHeader>
      <VaultsWrapper style={{ marginTop: "10px" }}>
        {filteredVaults.map((vault) => (
          <React.Fragment key={vault.vault.address}>
            <VaultRow onClick={() => toggleExpand(vault.vault.address)}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <HideButton
                  onClick={(e) => toggleHideVault(vault.vault.address, e)}
                  title={
                    hiddenVaults.includes(vault.vault.address)
                      ? "Show this vault"
                      : "Hide this vault"
                  }
                >
                  {hiddenVaults.includes(vault.vault.address) ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </HideButton>
                <VaultNameLink
                  href={vault.vault.link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ marginLeft: "8px" }}
                >
                  {vault.vault.link.name}
                </VaultNameLink>
              </div>
              <div>{vault.isV1_1 ? "v1.1" : "v0"}</div>
              <div>
                {Number(vault.timelock) % 86400 === 0
                  ? `${Number(vault.timelock) / 86400}`
                  : `${(Number(vault.timelock) / 86400).toFixed(1)}`}
              </div>
              <div>
                {formatUsdWithStyle(
                  formatUsdAmount(
                    Number(BigInt(Math.floor(vault.vault.totalAssetsUsd)) || 0n)
                  )
                )}
              </div>
              <div>
                {vault.warnings?.idlePositionWithdrawQueue ? (
                  <WarningText>Warning</WarningText>
                ) : (
                  "OK"
                )}
              </div>
              <div>
                {vault.warnings?.idlePositionSupplyQueue ? (
                  vault.warnings.idleSupplyQueueWarningReason ===
                  "deprecated" ? (
                    <WarningText>Vault deprecated</WarningText>
                  ) : vault.warnings.idleSupplyQueueWarningReason ===
                    "wrong_order" ? (
                    <YellowText>Wrong order</YellowText>
                  ) : (
                    <WarningText>Warning</WarningText>
                  )
                ) : (
                  "OK"
                )}
              </div>
              <div>
                {/* // if publiocAllocator is allocator, then we want to hceck : */}
                {vault.publicAllocatorIsAllocator ? (
                  <span style={{ color: "white" }}>Ok</span>
                ) : (
                  <WarningText>Not Ok</WarningText>
                )}
              </div>
              <div>{getFlowCapsStatus(vault)}</div>
              <div style={{ whiteSpace: "nowrap" }}>
                {vault.ownerSafeDetails.isSafe ? (
                  <AddressText
                    title={vault.owner}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(vault.owner);
                    }}
                  >
                    {formatAddress(vault.owner)}
                    {copiedAddress === vault.owner ? (
                      <CopyCheck size={12} style={{ color: "#2973FF" }} />
                    ) : (
                      <Copy size={12} />
                    )}
                    <img
                      src="https://app.safe.global/favicon.ico"
                      alt="Safe Icon"
                      width={12}
                      height={12}
                      style={{ marginLeft: "4px", verticalAlign: "middle" }}
                    />
                    <AddressText>
                      {vault.ownerSafeDetails.threshold?.toString()}/
                      {vault.ownerSafeDetails.owners?.length}
                    </AddressText>
                  </AddressText>
                ) : (
                  <BlinkingAddressText
                    title={vault.owner}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(vault.owner);
                    }}
                  >
                    {formatAddress(vault.owner)}
                    {copiedAddress === vault.owner ? (
                      <CopyCheck size={12} style={{ color: "#2973FF" }} />
                    ) : (
                      <Copy size={12} />
                    )}
                    <WarningText> ❌</WarningText>
                  </BlinkingAddressText>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                {vault.curator ===
                "0x0000000000000000000000000000000000000000" ? (
                  <AddressText>-</AddressText>
                ) : vault.curatorSafeDetails!.isSafe ? (
                  <AddressText
                    title={vault.curator}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(vault.curator);
                    }}
                  >
                    {formatAddress(vault.curator)}
                    {copiedAddress === vault.curator ? (
                      <CopyCheck size={12} style={{ color: "#2973FF" }} />
                    ) : (
                      <Copy size={12} />
                    )}
                    <img
                      src="https://app.safe.global/favicon.ico"
                      alt="Safe Icon"
                      width={12}
                      height={12}
                      style={{ marginLeft: "4px", verticalAlign: "middle" }}
                    />
                    <AddressText>
                      {vault.curatorSafeDetails.threshold?.toString()}/
                      {vault.curatorSafeDetails.owners?.length}
                    </AddressText>
                  </AddressText>
                ) : (
                  <BlinkingAddressText
                    title={vault.curator}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(vault.curator);
                    }}
                  >
                    {formatAddress(vault.curator)}
                    {copiedAddress === vault.curator ? (
                      <CopyCheck size={12} style={{ color: "#2973FF" }} />
                    ) : (
                      <Copy size={12} />
                    )}
                    <WarningText> ❌</WarningText>
                  </BlinkingAddressText>
                )}
                {expandedVault === vault.vault.address ? (
                  <ChevronUp
                    size={20}
                    style={{ color: "#2973FF", marginLeft: "10px" }}
                  />
                ) : (
                  <ChevronDown
                    size={20}
                    style={{ color: "#2973FF", marginLeft: "10px" }}
                  />
                )}
              </div>
              {expandedVault === vault.vault.address && (
                <ExpandedContent>
                  <BubbleContainer>
                    <WithdrawQueueBubble
                      expanded={true}
                      onClick={() => {}}
                      withdrawQueue={vault.withdrawQueue}
                      warnings={vault.warnings}
                    />
                    <SupplyQueueBubble
                      expanded={true}
                      onClick={() => {}}
                      supplyQueue={vault.supplyQueue}
                      warnings={vault.warnings}
                    />
                    <VaultFlowCapsBubble
                      expanded={true}
                      onClick={() => {}}
                      vault={vault}
                    />
                  </BubbleContainer>
                </ExpandedContent>
              )}
            </VaultRow>
          </React.Fragment>
        ))}
      </VaultsWrapper>
    </PageWrapper>
  );
};

export default VaultPage;

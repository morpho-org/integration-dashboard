import React from "react";
import styled from "styled-components";
import { useChainId } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const NavBarWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #5792FF;
  padding: 6px 12px;
  color: #2470ff;
  border-radius: 8px;
`;

const Title = styled.h1`
  font-size: 1.1rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
`;

const NetworkContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: auto;
  max-height: 32px;
`;


type NavBarProps = {
  currentNetwork: "ethereum" | "base" | "polygon" | "unichain" | "katana" | "arbitrum";
  onNetworkSwitch: (network: "ethereum" | "base" | "polygon" | "unichain" | "katana" | "arbitrum") => void;
};

const NavBar: React.FC<NavBarProps> = ({ currentNetwork, onNetworkSwitch }) => {
  const chainId = useChainId();
  
  // Map chainId to network name
  const getNetworkFromChainId = (chainId: number): "ethereum" | "base" | "polygon" | "unichain" | "katana" | "arbitrum" => {
    switch (chainId) {
      case 1: return "ethereum";
      case 8453: return "base";
      case 137: return "polygon";
      case 130: return "unichain";
      case 747474: return "katana";
      case 42161: return "arbitrum";
      default: return "ethereum";
    }
  };

  // Use connected wallet's chainId as the current network
  const connectedNetwork = getNetworkFromChainId(chainId);
  
  // Update parent when chainId changes (with debouncing to prevent loops)
  React.useEffect(() => {
    if (connectedNetwork !== currentNetwork) {
      // Add a small delay to prevent rapid switching
      const timeoutId = setTimeout(() => {
        onNetworkSwitch(connectedNetwork);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [connectedNetwork, currentNetwork, onNetworkSwitch]);

  return (
    <NavBarWrapper>
      <Title>Manual Reallocation</Title>
      <NetworkContainer>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              mounted,
            }) => {
              const ready = mounted;
              const connected = ready && account && chain;

              return (
                <div
                  {...(!ready && {
                    'aria-hidden': true,
                    style: {
                      opacity: 0,
                      pointerEvents: 'none',
                      userSelect: 'none',
                    },
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <button
                          onClick={openConnectModal}
                          type="button"
                          style={{
                            background: 'white',
                            border: '2px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            fontSize: '12px',
                            fontWeight: '500',
                            color: '#1a202c',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          onMouseEnter={(e) => {
                            const target = e.target as HTMLButtonElement;
                            target.style.backgroundColor = '#f7fafc';
                            target.style.borderColor = '#cbd5e0';
                          }}
                          onMouseLeave={(e) => {
                            const target = e.target as HTMLButtonElement;
                            target.style.backgroundColor = 'white';
                            target.style.borderColor = '#e2e8f0';
                          }}
                        >
                          Connect Wallet
                        </button>
                      );
                    }

                    if (chain.unsupported) {
                      return (
                        <button
                          onClick={openChainModal}
                          type="button"
                          style={{
                            background: '#fed7d7',
                            border: '2px solid #fc8181',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#742a2a',
                            cursor: 'pointer',
                          }}
                        >
                          Wrong network
                        </button>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={openChainModal}
                          style={{
                            background: 'white',
                            border: '2px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: '500',
                            color: '#4a5568',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            const target = e.target as HTMLButtonElement;
                            target.style.backgroundColor = '#f7fafc';
                          }}
                          onMouseLeave={(e) => {
                            const target = e.target as HTMLButtonElement;
                            target.style.backgroundColor = 'white';
                          }}
                          type="button"
                        >
                          {chain.hasIcon && (
                            <div
                              style={{
                                background: chain.iconBackground,
                                width: 16,
                                height: 16,
                                borderRadius: 999,
                                overflow: 'hidden',
                              }}
                            >
                              {chain.iconUrl && (
                                <img
                                  alt={chain.name ?? 'Chain icon'}
                                  src={chain.iconUrl}
                                  style={{ width: 16, height: 16 }}
                                />
                              )}
                            </div>
                          )}
                          {(chain.name || '').length > 8 ? (chain.name || '').substring(0, 8) + '...' : (chain.name || 'Unknown')}
                        </button>

                        <button
                          onClick={openAccountModal}
                          type="button"
                          style={{
                            background: 'white',
                            border: '2px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: '500',
                            color: '#4a5568',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            const target = e.target as HTMLButtonElement;
                            target.style.backgroundColor = '#f7fafc';
                          }}
                          onMouseLeave={(e) => {
                            const target = e.target as HTMLButtonElement;
                            target.style.backgroundColor = 'white';
                          }}
                        >
                          {account.displayName.length > 10 
                            ? `${account.displayName.substring(0, 6)}...${account.displayName.substring(account.displayName.length - 4)}`
                            : account.displayName
                          }
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </NetworkContainer>
    </NavBarWrapper>
  );
};

export default NavBar;

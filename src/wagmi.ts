import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, mainnet, sepolia, polygon, unichain, arbitrum } from "wagmi/chains";
import { type Chain } from "viem";

export const katana = {
  id: 747474,
  name: "Katana",
  nativeCurrency: { 
    name: "Ether", 
    symbol: "ETH", 
    decimals: 18 
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.katana.network/"]
    },
  },
  blockExplorers: {
    default: {
      name: "KatanaScan",
      url: "https://www.katanascan.com/"
    }
  },
  contracts: {
    multicall3: {
      address: "0xca11bde05977b3631167028862be2a173976ca11",
      blockCreated: 1
    }
  }
} as const satisfies Chain;

export const config = getDefaultConfig({
  appName: "RainbowKit demo",
  projectId: "YOUR_PROJECT_ID",
  chains: [
    mainnet,
    base,
    polygon,
    unichain,
    arbitrum,
    katana,
    ...(process.env.REACT_APP_ENABLE_TESTNETS === "true" ? [sepolia] : []),
  ],
});

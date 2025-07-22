import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, mainnet, sepolia, polygon, unichain, arbitrum } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "RainbowKit demo",
  projectId: "YOUR_PROJECT_ID",
  chains: [
    mainnet,
    base,
    polygon,
    unichain,
    arbitrum,
    ...(process.env.REACT_APP_ENABLE_TESTNETS === "true" ? [sepolia] : []),
  ],
});

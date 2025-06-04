import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, mainnet, sepolia, polygon, unichain } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "RainbowKit demo",
  projectId: "YOUR_PROJECT_ID",
  chains: [
    mainnet,
    base,
    polygon,
    unichain,
    ...(process.env.REACT_APP_ENABLE_TESTNETS === "true" ? [sepolia] : []),
  ],
});

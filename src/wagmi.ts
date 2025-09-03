import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, mainnet, sepolia, polygon, unichain, arbitrum } from "wagmi/chains";
import { katana } from "./utils/client";

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

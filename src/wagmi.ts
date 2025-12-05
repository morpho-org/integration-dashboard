import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, mainnet, sepolia, polygon, unichain, arbitrum } from "wagmi/chains";
import { katana, monad } from "./utils/client";

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
    monad,
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === "true" ? [sepolia] : []),
  ],
});

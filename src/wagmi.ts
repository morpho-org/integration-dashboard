import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arbitrum, base, mainnet, optimism, polygon, sepolia, unichain } from "wagmi/chains";
import { katana, monad, stable } from "./utils/client";

export const config = getDefaultConfig({
  appName: "RainbowKit demo",
  projectId: "YOUR_PROJECT_ID",
  chains: [
    mainnet,
    base,
    optimism,
    polygon,
    unichain,
    arbitrum,
    katana,
    monad,
    stable,
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === "true" ? [sepolia] : []),
  ],
});

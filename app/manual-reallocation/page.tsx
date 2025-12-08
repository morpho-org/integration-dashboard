"use client";

import { useState } from "react";
import NavBar from "../../src/components/NavBar";
import { SupportedNetwork } from "../../src/types/networks";
import ManualReallocationPage from "../../src/views/manualReallocationPage";

export default function ManualReallocation() {
  const [network, setNetwork] = useState<SupportedNetwork>("ethereum");

  const handleNetworkSwitch = (selectedNetwork: SupportedNetwork) => {
    setNetwork(selectedNetwork);
  };

  return (
    <div className="w-full p-1 bg-[#F9FAFB]">
      <div className="w-full px-4 mb-2">
        <NavBar
          currentNetwork={network}
          onNetworkSwitch={handleNetworkSwitch}
        />
      </div>
      <div
        className="px-3 pb-3 rounded-t-lg min-h-screen"
        style={{
          background:
            "linear-gradient(180deg, rgba(21, 24, 26, 0.00) 63.77%, rgba(255, 255, 255, 0.04) 89.72%), var(--Background-Base, #F9FAFB)",
        }}
      >
        <ManualReallocationPage network={network} />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import NavBar from "../../src/components/NavBar";
import { SupportedNetwork } from "../../src/types/networks";
import ManualReallocationPage from "../../src/views/manualReallocationPage";

export default function ManualReallocationClient() {
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
      <footer className="px-4 py-6 text-xs text-gray-500">
        <p>
          <strong>Disclaimer</strong> - This simulator is provided for
          informational and educational purposes only. The information and
          results displayed are theoretical estimates based on user-selected
          inputs and do not constitute investment advice, a personal
          recommendation, financial research, an offer, or a solicitation to buy
          or sell any financial instrument or digital asset. Simulated or
          hypothetical performance is not indicative of future results.
          Strategies involving leverage carry significant risks, including the
          risk of liquidation and the loss of part or all of the invested
          capital. Users are solely responsible for their use of this simulator
          and for any decisions made based on the information provided. Users
          should conduct their own independent analysis and, where appropriate,
          seek advice from qualified professional advisors before making any
          financial decision. Morpho Association shall not be held liable for any
          losses or damages arising from the use of this simulator.
        </p>
      </footer>
    </div>
  );
}

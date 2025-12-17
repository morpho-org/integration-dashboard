"use client";

import dynamic from "next/dynamic";

// Dynamically import the client component with SSR disabled
// This prevents WalletConnect from trying to access localStorage during build
const LoopingCalculatorContent = dynamic(
  () => import("./LoopingCalculatorClient"),
  { ssr: false }
);

export default function LoopingCalculatorPage() {
  return <LoopingCalculatorContent />;
}

"use client";

import dynamic from "next/dynamic";

// Dynamically import the client component with SSR disabled
// This prevents WalletConnect from trying to access localStorage during build
const HomeContent = dynamic(() => import("./HomeClient"), { ssr: false });

export default function Home() {
  return <HomeContent />;
}

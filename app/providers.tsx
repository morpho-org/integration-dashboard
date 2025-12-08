"use client";

import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useState } from "react";
import { WagmiProvider } from "wagmi";
import { config } from "../src/wagmi";

/**
 * Root Providers component for the application.
 *
 * QueryClient is created inside the component (not at module scope) to prevent
 * hydration mismatches. Using useState ensures the client is created once per
 * component instance and persists across re-renders.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  // Create QueryClient inside component to avoid SSR/hydration issues
  // useState with initializer function ensures it's only created once
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Prevent refetching on window focus during hydration
            refetchOnWindowFocus: false,
            // Avoid retries during initial hydration
            retry: 1,
          },
        },
      })
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

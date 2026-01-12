"use client";

import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useState, useEffect } from "react";
import { WagmiProvider, type Config } from "wagmi";

/**
 * Root Providers component for the application.
 *
 * QueryClient is created inside the component (not at module scope) to prevent
 * hydration mismatches. Using useState ensures the client is created once per
 * component instance and persists across re-renders.
 *
 * The wagmi config is dynamically imported only on the client side to prevent
 * WalletConnect from trying to access localStorage during SSR/prerendering.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  // Track mounting state, wagmi config, and potential load errors
  const [mounted, setMounted] = useState(false);
  const [wagmiConfig, setWagmiConfig] = useState<Config | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  // Dynamically import wagmi config only on client side
  useEffect(() => {
    import("../src/wagmi")
      .then((module) => {
        setWagmiConfig(module.config);
        setMounted(true);
      })
      .catch((error) => {
        console.error("Failed to load wallet configuration:", error);
        setLoadError("Failed to initialize wallet connection. Please refresh the page.");
        setMounted(true);
      });
  }, []);

  // Show error if wallet config failed to load
  if (loadError) {
    return (
      <div className="p-4 text-red-600">
        {loadError}
        {children}
      </div>
    );
  }

  // Show minimal loading state while wagmi config loads
  // Don't render children without providers - components may use wagmi hooks
  if (!mounted || !wagmiConfig) {
    return (
      <div className="min-h-screen bg-[#F9FAFB]">
        <div className="w-full px-4 py-2">
          <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

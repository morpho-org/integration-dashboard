"use client";

import dynamic from "next/dynamic";
import { type ReactNode } from "react";

const Providers = dynamic(
  () =>
    import("./providers").then((mod) => mod.Providers).catch((error) => {
      console.error("Failed to load Providers:", error);
      // Return a fallback component that shows an error to the user
      return function ProvidersFallback({ children }: { children: ReactNode }) {
        return (
          <div className="p-4 text-red-600">
            Failed to load application providers. Please refresh the page.
            {children}
          </div>
        );
      };
    }),
  {
    ssr: false,
    loading: () => <div className="p-4">Loading...</div>,
  }
);

interface ClientProvidersProps {
  children: ReactNode;
}

export function ClientProviders({ children }: ClientProvidersProps): ReactNode {
  return <Providers>{children}</Providers>;
}

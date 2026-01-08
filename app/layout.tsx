import type { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";
import { ClientProviders } from "./client-providers";

export const metadata: Metadata = {
  title: "Manual Reallocation Dashboard",
  description: "Morpho Integration Dashboard for Manual Reallocation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <NuqsAdapter>
          <ClientProviders>{children}</ClientProviders>
        </NuqsAdapter>
      </body>
    </html>
  );
}

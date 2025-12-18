"use client";

import dynamic from "next/dynamic";
import { ReactNode } from "react";

const Providers = dynamic(() => import("./providers").then((mod) => mod.Providers), {
  ssr: false,
});

export function ClientProviders({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}

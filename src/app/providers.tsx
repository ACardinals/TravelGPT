"use client";

import { SessionProvider } from "next-auth/react";
import { TRPCReactProvider } from "@/trpc/react"; // 假设您的 tRPC provider 在这里
import React from "react";

interface ProvidersProps {
  children: React.ReactNode;
  // session: any; // 如果需要传递初始 session
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <TRPCReactProvider>
        {children}
      </TRPCReactProvider>
    </SessionProvider>
  );
} 
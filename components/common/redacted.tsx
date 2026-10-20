"use client";

import { usePrivacy } from "@/contexts/privacy-context";
import React from "react";

export function Redacted({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { isRedacted } = usePrivacy();

  if (isRedacted) {
    return <span className={`select-none tracking-widest ${className}`}>••••••••</span>;
  }

  return <span className={className}>{children}</span>;
}

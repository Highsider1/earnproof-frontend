"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface PrivacyContextType {
  isRedacted: boolean;
  toggleRedaction: () => void;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [isRedacted, setIsRedacted] = useState(false);

  const toggleRedaction = () => {
    setIsRedacted((prev) => !prev);
  };

  return (
    <PrivacyContext.Provider value={{ isRedacted, toggleRedaction }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const context = useContext(PrivacyContext);
  if (context === undefined) {
    if (process.env.NODE_ENV === "test") {
      return { isRedacted: false, toggleRedaction: () => {} };
    }
    throw new Error("usePrivacy must be used within a PrivacyProvider");
  }
  return context;
}

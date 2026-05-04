"use client";

import { createContext, useContext } from "react";

const SidebarReaderFocusContext = createContext(false);

export function SidebarReaderFocusProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: boolean;
}) {
  return (
    <SidebarReaderFocusContext.Provider value={value}>
      {children}
    </SidebarReaderFocusContext.Provider>
  );
}

export function useSidebarReaderFocus() {
  return useContext(SidebarReaderFocusContext);
}

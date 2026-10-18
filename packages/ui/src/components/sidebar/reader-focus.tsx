"use client";

import { createContext, use } from "react";

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
  return use(SidebarReaderFocusContext);
}

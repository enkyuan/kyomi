import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from "react";

export type ReaderTabBarConfig = {
  readonly isSaved: boolean;
  readonly isUpdating: boolean;
  readonly searchQuery: string;
  readonly onOpenSource: () => void;
  readonly onSearchQueryChange: (query: string) => void;
  readonly onShare: () => void;
  readonly onToggleSaved: () => void;
};

type ReaderTabBarContextValue = {
  readonly config: ReaderTabBarConfig | null;
  readonly setConfig: Dispatch<SetStateAction<ReaderTabBarConfig | null>>;
};

const ReaderTabBarContext = createContext<ReaderTabBarContextValue | null>(null);

export function ReaderTabBarProvider({ children }: PropsWithChildren) {
  const [config, setConfig] = useState<ReaderTabBarConfig | null>(null);
  const value = useMemo(() => ({ config, setConfig }), [config]);

  return <ReaderTabBarContext value={value}>{children}</ReaderTabBarContext>;
}

export function useReaderTabBar() {
  const context = useContext(ReaderTabBarContext);
  if (!context) {
    throw new Error("useReaderTabBar must be used within ReaderTabBarProvider.");
  }
  return context;
}

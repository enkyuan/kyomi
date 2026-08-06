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
  readonly isDismissingReader: boolean;
  readonly setConfig: Dispatch<SetStateAction<ReaderTabBarConfig | null>>;
  readonly setIsDismissingReader: Dispatch<SetStateAction<boolean>>;
};

const ReaderTabBarContext = createContext<ReaderTabBarContextValue | null>(null);

export function ReaderTabBarProvider({ children }: PropsWithChildren) {
  const [config, setConfig] = useState<ReaderTabBarConfig | null>(null);
  const [isDismissingReader, setIsDismissingReader] = useState(false);
  const value = useMemo(
    () => ({ config, isDismissingReader, setConfig, setIsDismissingReader }),
    [config, isDismissingReader],
  );

  return <ReaderTabBarContext value={value}>{children}</ReaderTabBarContext>;
}

export function useReaderTabBar() {
  const context = useContext(ReaderTabBarContext);
  if (!context) {
    throw new Error("useReaderTabBar must be used within ReaderTabBarProvider.");
  }
  return context;
}

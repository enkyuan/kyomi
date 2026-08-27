import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from "react";

export type ReaderTabConfig = {
  readonly isSaved: boolean;
  readonly isUpdating: boolean;
  readonly searchQuery: string;
  readonly onOpenSource: () => void;
  readonly onSearchQueryChange: (query: string) => void;
  readonly onShare: () => void;
  readonly onToggleSaved: () => void;
};

type ReaderTabContextValue = {
  readonly config: ReaderTabConfig | null;
  readonly isDismissingReader: boolean;
  readonly setConfig: Dispatch<SetStateAction<ReaderTabConfig | null>>;
  readonly setIsDismissingReader: Dispatch<SetStateAction<boolean>>;
};

const ReaderTabContext = createContext<ReaderTabContextValue | null>(null);

export function ReaderTabProvider({ children }: PropsWithChildren) {
  const [config, setConfig] = useState<ReaderTabConfig | null>(null);
  const [isDismissingReader, setIsDismissingReader] = useState(false);
  const value = useMemo(
    () => ({ config, isDismissingReader, setConfig, setIsDismissingReader }),
    [config, isDismissingReader],
  );

  return <ReaderTabContext value={value}>{children}</ReaderTabContext>;
}

export function useReaderTab() {
  const context = useContext(ReaderTabContext);
  if (!context) {
    throw new Error("useReaderTab must be used within ReaderTabProvider.");
  }
  return context;
}

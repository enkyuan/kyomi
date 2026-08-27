import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from "react";

export type SearchTabConfig = {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
};

type SearchTabContextValue = {
  readonly config: SearchTabConfig | null;
  readonly setConfig: Dispatch<SetStateAction<SearchTabConfig | null>>;
};

const SearchTabContext = createContext<SearchTabContextValue | null>(null);

export function SearchTabProvider({ children }: PropsWithChildren) {
  const [config, setConfig] = useState<SearchTabConfig | null>(null);
  const value = useMemo(() => ({ config, setConfig }), [config]);

  return <SearchTabContext value={value}>{children}</SearchTabContext>;
}

export function useSearchTab() {
  const context = useContext(SearchTabContext);
  if (!context) {
    throw new Error("useSearchTab must be used within SearchTabProvider.");
  }
  return context;
}

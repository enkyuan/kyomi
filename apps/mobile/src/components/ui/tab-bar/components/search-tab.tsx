import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

type SearchTabContextValue = {
  readonly requestOpen: () => void;
  readonly searchRequestId: number;
};

const SearchTabContext = createContext<SearchTabContextValue | null>(null);

export function SearchTabProvider({ children }: PropsWithChildren) {
  const [searchRequestId, setSearchRequestId] = useState(0);
  const requestOpen = useCallback(() => setSearchRequestId((value) => value + 1), []);
  const value = useMemo(() => ({ requestOpen, searchRequestId }), [requestOpen, searchRequestId]);

  return <SearchTabContext value={value}>{children}</SearchTabContext>;
}

export function useSearchTab() {
  const context = useContext(SearchTabContext);
  if (!context) throw new Error("useSearchTab must be used within SearchTabProvider.");
  return context;
}

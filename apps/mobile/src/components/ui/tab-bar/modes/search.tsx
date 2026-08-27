import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from "react";

export type SearchTabBarConfig = {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
};

type SearchTabBarContextValue = {
  readonly config: SearchTabBarConfig | null;
  readonly setConfig: Dispatch<SetStateAction<SearchTabBarConfig | null>>;
};

const SearchTabBarContext = createContext<SearchTabBarContextValue | null>(null);

export function SearchTabBarProvider({ children }: PropsWithChildren) {
  const [config, setConfig] = useState<SearchTabBarConfig | null>(null);
  const value = useMemo(() => ({ config, setConfig }), [config]);

  return <SearchTabBarContext value={value}>{children}</SearchTabBarContext>;
}

export function useSearchTabBar() {
  const context = useContext(SearchTabBarContext);
  if (!context) {
    throw new Error("useSearchTabBar must be used within SearchTabBarProvider.");
  }
  return context;
}

/** Backward compatibility aliases */
export type AddTabBarConfig = SearchTabBarConfig;
export const AddTabBarProvider = SearchTabBarProvider;
export const useAddTabBar = useSearchTabBar;

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from "react";

export type AddTabBarConfig = {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
};

type AddTabBarContextValue = {
  readonly config: AddTabBarConfig | null;
  readonly setConfig: Dispatch<SetStateAction<AddTabBarConfig | null>>;
};

const AddTabBarContext = createContext<AddTabBarContextValue | null>(null);

export function AddTabBarProvider({ children }: PropsWithChildren) {
  const [config, setConfig] = useState<AddTabBarConfig | null>(null);
  const value = useMemo(() => ({ config, setConfig }), [config]);

  return <AddTabBarContext value={value}>{children}</AddTabBarContext>;
}

export function useAddTabBar() {
  const context = useContext(AddTabBarContext);
  if (!context) {
    throw new Error("useAddTabBar must be used within AddTabBarProvider.");
  }
  return context;
}

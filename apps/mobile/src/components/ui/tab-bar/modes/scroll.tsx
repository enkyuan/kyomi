import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from "react";

type ScrollTabBarContextValue = {
  readonly isMinimized: boolean;
  readonly setIsMinimized: Dispatch<SetStateAction<boolean>>;
};

const ScrollTabBarContext = createContext<ScrollTabBarContextValue>({
  isMinimized: false,
  setIsMinimized: () => {},
});

export function ScrollTabBarProvider({ children }: PropsWithChildren) {
  const [isMinimized, setIsMinimized] = useState(false);
  const value = useMemo(() => ({ isMinimized, setIsMinimized }), [isMinimized]);

  return <ScrollTabBarContext.Provider value={value}>{children}</ScrollTabBarContext.Provider>;
}

export function useScrollTabBar() {
  return useContext(ScrollTabBarContext);
}

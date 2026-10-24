import { useIsFocused } from "expo-router";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { Platform } from "react-native";
import { useAnimatedReaction, useSharedValue, type SharedValue } from "react-native-reanimated";

type SharedTitle = {
  readonly title: string | null;
  /** Bumped on every change, which is what the native title animates on. */
  readonly version: number;
};

type SharedTitleControls = {
  readonly scrollY: SharedValue<number>;
  readonly show: (title: string) => void;
  readonly hide: (title: string) => void;
};

const ControlsContext = createContext<SharedTitleControls | null>(null);
const TitleContext = createContext<SharedTitle>({ title: null, version: 0 });

/**
 * Holds the title of whichever sibling screen (tab) is showing, and its scroll offset, in one
 * place above the screens. The title is drawn once, by `SharedHeaderTitle`, so it can change in
 * place and animate; a header inside each screen swaps out with its screen and cannot.
 */
export function SharedHeaderTitleProvider({ children }: PropsWithChildren) {
  const [shared, setShared] = useState<SharedTitle>({ title: null, version: 0 });
  const scrollY = useSharedValue(0);

  const show = useCallback((title: string) => {
    setShared((current) =>
      current.title === title ? current : { title, version: current.version + 1 },
    );
  }, []);
  // Only the title that is showing can hide itself, so a screen that blurs as another takes
  // over leaves the newcomer's title alone.
  const hide = useCallback((title: string) => {
    setShared((current) =>
      current.title === title ? { title: null, version: current.version + 1 } : current,
    );
  }, []);

  const controls = useMemo(() => ({ hide, scrollY, show }), [hide, scrollY, show]);

  return createElement(
    ControlsContext,
    { value: controls },
    createElement(TitleContext, { value: shared }, children),
  );
}

/** For the view that draws the title. */
export function useSharedHeaderTitleState() {
  return { ...useContext(TitleContext), scrollY: useContext(ControlsContext)?.scrollY ?? null };
}

/**
 * A screen hands its title and scroll offset to the shared title while it is focused. Returns
 * whether the shared title draws it, so the screen's own header leaves its title out. Only iOS
 * draws the shared title; elsewhere the screen's header keeps its own.
 */
export function useSharedHeaderTitle(title: string, scrollY: SharedValue<number>) {
  const controls = useContext(ControlsContext);
  const focused = useIsFocused();
  const focusedSV = useSharedValue(false);
  const sharedScrollY = controls?.scrollY;
  const draws = Platform.OS === "ios" && controls !== null;

  useEffect(() => {
    if (!draws || !controls || !focused) return;
    controls.show(title);
    controls.scrollY.set(scrollY.get());
    focusedSV.set(true);
    return () => {
      focusedSV.set(false);
      controls.hide(title);
    };
  }, [controls, draws, focused, focusedSV, scrollY, title]);

  useAnimatedReaction(
    () => (focusedSV.get() ? scrollY.get() : null),
    (y) => {
      if (y !== null && sharedScrollY) sharedScrollY.set(y);
    },
    [sharedScrollY],
  );

  return draws;
}

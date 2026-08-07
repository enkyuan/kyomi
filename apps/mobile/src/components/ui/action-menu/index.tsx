import { useEffect, useState, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { triggerSelectionHaptic } from "@utils/haptics";
import { useLiquidGlassAvailable } from "@ui/liquid-glass/use-availability";
import { ActionMenuSurface } from "./surface";

const ANIMATION_DURATION = 180;
const ROW_STAGGER = 36;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ActionMenuItem = {
  readonly id: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly accessibilityLabel?: string;
  readonly onPress?: () => void;
};

type ActionMenuProps = {
  readonly isOpen: boolean;
  readonly items: readonly ActionMenuItem[];
  readonly onDismiss: () => void;
  /** Bottom offset from the physical screen edge, including any persistent chrome. */
  readonly bottomOffset: number;
  /** Defaults to the trailing edge so a menu can expand from a right-side action. */
  readonly alignment?: "start" | "end";
};

/**
 * A controlled, full-screen action menu that expands from either lower corner.
 * Consumers supply the trigger and item behavior; this primitive owns only
 * presentation, dismissal, accessibility, and the staggered menu motion.
 */
export function ActionMenu({
  alignment = "end",
  bottomOffset,
  isOpen,
  items,
  onDismiss,
}: ActionMenuProps) {
  const shouldReduceMotion = useReducedMotion();
  const usesLiquidGlass = useLiquidGlassAvailable();
  const [isPresented, setIsPresented] = useState(isOpen);
  const backdropProgress = useSharedValue(0);

  useEffect(() => {
    let dismissTimer: ReturnType<typeof setTimeout> | undefined;

    if (isOpen) {
      setIsPresented(true);
      backdropProgress.value = shouldReduceMotion
        ? 1
        : withTiming(1, { duration: ANIMATION_DURATION });
    } else {
      backdropProgress.value = shouldReduceMotion
        ? 0
        : withTiming(0, { duration: ANIMATION_DURATION });
      dismissTimer = setTimeout(
        () => setIsPresented(false),
        shouldReduceMotion ? 0 : ANIMATION_DURATION,
      );
    }

    return () => {
      if (dismissTimer) {
        clearTimeout(dismissTimer);
      }
    };
  }, [backdropProgress, isOpen, shouldReduceMotion]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropProgress.value,
  }));

  if (!isPresented || items.length === 0) {
    return null;
  }

  const alignmentStyle = alignment === "end" ? styles.endAligned : styles.startAligned;

  return (
    <Modal animationType="none" onRequestClose={onDismiss} statusBarTranslucent transparent visible>
      <View accessibilityViewIsModal style={styles.container}>
        <AnimatedPressable
          accessibilityLabel="Dismiss actions menu"
          accessibilityRole="button"
          onPress={onDismiss}
          style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
        />
        <View pointerEvents="box-none" style={styles.menuContainer}>
          <View style={[styles.items, alignmentStyle, { bottom: bottomOffset }]}>
            {items.map((item, index) => (
              <AnimatedActionMenuItem
                alignment={alignment}
                item={item}
                key={item.id}
                onDismiss={onDismiss}
                open={isOpen}
                order={index}
                shouldReduceMotion={shouldReduceMotion}
                usesLiquidGlass={usesLiquidGlass}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AnimatedActionMenuItem({
  alignment,
  item,
  onDismiss,
  open,
  order,
  shouldReduceMotion,
  usesLiquidGlass,
}: {
  readonly alignment: "start" | "end";
  readonly item: ActionMenuItem;
  readonly onDismiss: () => void;
  readonly open: boolean;
  readonly order: number;
  readonly shouldReduceMotion: boolean;
  readonly usesLiquidGlass: boolean;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    const delay = shouldReduceMotion ? 0 : open ? order * ROW_STAGGER : 0;
    progress.value = shouldReduceMotion
      ? open
        ? 1
        : 0
      : withDelay(delay, withTiming(open ? 1 : 0, { duration: ANIMATION_DURATION }));
  }, [open, order, progress, shouldReduceMotion]);

  const rowStyle = useAnimatedStyle(() => {
    const x = alignment === "end" ? 24 : -24;

    return {
      opacity: progress.value,
      transform: [
        { translateX: interpolate(progress.value, [0, 1], [x, 0]) },
        { translateY: interpolate(progress.value, [0, 1], [12 + order * 8, 0]) },
        { scale: interpolate(progress.value, [0, 1], [0.94, 1]) },
      ],
    };
  });

  const handlePress = () => {
    void triggerSelectionHaptic();
    item.onPress?.();
    onDismiss();
  };

  return (
    <Animated.View style={rowStyle}>
      <ActionMenuSurface style={styles.surface} usesLiquidGlass={usesLiquidGlass}>
        <Pressable
          accessibilityLabel={item.accessibilityLabel ?? item.label}
          accessibilityRole="button"
          className={
            alignment === "end"
              ? "flex-row-reverse items-center gap-3 px-4"
              : "flex-row items-center gap-3 px-4"
          }
          onPress={handlePress}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <View accessible={false} style={styles.icon}>
            {item.icon}
          </View>
          <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
            {item.label}
          </Text>
        </Pressable>
      </ActionMenuSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.28)",
  },
  menuContainer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  items: {
    position: "absolute",
    gap: 12,
    maxWidth: "100%",
  },
  startAligned: {
    left: 20,
  },
  endAligned: {
    right: 20,
    alignItems: "flex-end",
  },
  surface: {
    borderRadius: 24,
    overflow: "hidden",
  },
  action: {
    minWidth: 176,
    height: 48,
    justifyContent: "center",
  },
  actionPressed: {
    opacity: 0.72,
  },
  icon: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});

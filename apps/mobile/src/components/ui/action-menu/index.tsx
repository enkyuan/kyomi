import { useEffect, useRef, useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { useReducedMotion, useSharedValue } from "react-native-reanimated";
import { useLiquidGlassAvailable } from "@ui/liquid-glass/use-availability";
import { ActionMenuBackdrop } from "./atoms/backdrop";
import { AnimatedActionMenuRow } from "./atoms/animated-row";
import { ActionMenuItem } from "./atoms/item";
import {
  ACTION_MENU_ICON_SIZE,
  type ActionMenuAnchor,
  type ActionMenuItem as ActionMenuItemModel,
} from "./lib/model";
import { ActionMenuSurface } from "./atoms/surface";

export { ACTION_MENU_ICON_SIZE, type ActionMenuAnchor, type ActionMenuItem } from "./lib/model";

const DISMISS_DURATION = 220;
const ITEM_GAP = 8;

type ActionMenuProps = {
  readonly isOpen: boolean;
  readonly items: readonly ActionMenuItemModel[];
  readonly onDismiss: () => void;
  /** Called after the menu's closing motion has completed. */
  readonly onDismissComplete?: () => void;
  /** Bottom offset from the physical screen edge, including any persistent chrome. */
  readonly bottomOffset: number;
  /** Physical edge offset for the menu item's outer edge. */
  readonly edgeOffset?: number;
  /** Defaults to the trailing edge so a menu can expand from a right-side action. */
  readonly alignment?: "start" | "end";
  /** An optional visual continuation of the trigger above the overlay. */
  readonly anchor?: ActionMenuAnchor;
};

/**
 * A controlled full-screen action menu. The menu owns the dimmed overlay and
 * staggered action rows; callers provide its trigger, placement, and behavior.
 */
export function ActionMenu({
  alignment = "end",
  anchor,
  bottomOffset,
  edgeOffset = 20,
  isOpen,
  items,
  onDismiss,
  onDismissComplete,
}: ActionMenuProps) {
  const [isPresented, setIsPresented] = useState(false);
  const didPresentRef = useRef(false);
  const onDismissCompleteRef = useRef(onDismissComplete);
  const itemsHeight = useSharedValue(0);
  const menuOpen = useSharedValue(false);
  const shouldReduceMotion = useReducedMotion();
  const usesLiquidGlass = useLiquidGlassAvailable();

  onDismissCompleteRef.current = onDismissComplete;

  useEffect(() => {
    let dismissTimer: ReturnType<typeof setTimeout> | undefined;
    let frame: ReturnType<typeof requestAnimationFrame> | undefined;

    if (isOpen) {
      didPresentRef.current = true;
      setIsPresented(true);
      if (shouldReduceMotion) {
        menuOpen.value = true;
      } else {
        // Mount the closed state first so each row has a real origin to spring from.
        frame = requestAnimationFrame(() => {
          menuOpen.value = true;
        });
      }
    } else {
      menuOpen.value = false;
      if (!didPresentRef.current) {
        return;
      }
      dismissTimer = setTimeout(
        () => {
          setIsPresented(false);
          didPresentRef.current = false;
          onDismissCompleteRef.current?.();
        },
        shouldReduceMotion ? 0 : DISMISS_DURATION,
      );
    }

    return () => {
      if (dismissTimer) {
        clearTimeout(dismissTimer);
      }
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, [isOpen, menuOpen, shouldReduceMotion]);

  if (!isPresented || items.length === 0) {
    return null;
  }

  const alignmentStyle =
    alignment === "end"
      ? { right: getItemEdgeOffset(anchor, edgeOffset), alignItems: "flex-end" as const }
      : { left: getItemEdgeOffset(anchor, edgeOffset), alignItems: "flex-start" as const };

  return (
    <Modal animationType="none" onRequestClose={onDismiss} statusBarTranslucent transparent visible>
      <View accessibilityViewIsModal style={styles.container}>
        <ActionMenuBackdrop
          isOpen={menuOpen}
          onDismiss={onDismiss}
          shouldReduceMotion={shouldReduceMotion}
        />
        <View pointerEvents={isOpen ? "box-none" : "none"} style={styles.menuContainer}>
          <View
            onLayout={(event) => {
              itemsHeight.value = event.nativeEvent.layout.height;
            }}
            style={[styles.items, alignmentStyle, { bottom: bottomOffset }]}
          >
            {items.map((item, index) => (
              <AnimatedActionMenuRow
                alignment={alignment}
                containerHeight={itemsHeight}
                index={index}
                isOpen={menuOpen}
                key={item.id}
                numberOfRows={items.length}
                shouldReduceMotion={shouldReduceMotion}
              >
                <ActionMenuItem alignment={alignment} item={item} onDismiss={onDismiss} />
              </AnimatedActionMenuRow>
            ))}
          </View>
        </View>
        {anchor ? (
          <ActionMenuSurface
            style={[
              styles.anchor,
              {
                bottom: anchor.bottomOffset,
                height: anchor.height,
                width: anchor.width,
              },
              alignment === "end" ? { right: anchor.edgeOffset } : { left: anchor.edgeOffset },
            ]}
            usesLiquidGlass={usesLiquidGlass}
          >
            {anchor.content}
          </ActionMenuSurface>
        ) : null}
      </View>
    </Modal>
  );
}

/** Centers the option-icon column on the persistent action's centerline. */
function getItemEdgeOffset(anchor: ActionMenuAnchor | undefined, edgeOffset: number) {
  if (!anchor) {
    return edgeOffset;
  }

  return edgeOffset + Math.max(0, (anchor.width - ACTION_MENU_ICON_SIZE) / 2);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  menuContainer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "flex-end",
  },
  items: {
    gap: ITEM_GAP,
    position: "absolute",
  },
  anchor: {
    borderRadius: 28,
    overflow: "hidden",
    position: "absolute",
  },
});

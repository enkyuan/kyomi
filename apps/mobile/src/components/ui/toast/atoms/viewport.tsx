import {
  LiquidGlassContainerView,
  LiquidGlassView,
  isLiquidGlassSupported,
} from "@callstack/liquid-glass";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mobileColors } from "@/theme/colors";
import { FONT_FAMILIES, FONT_STYLES, FONT_WEIGHTS } from "@/theme/fonts";
import { engine, hapticForToast, type RenderToast } from "../lib/manager";
import type { Toast } from "../lib/model";
import type { ToastColor } from "../lib/style";
import type { ToastPosition, ToastSemantic } from "../lib/types";

const POSITIONS: readonly ToastPosition[] = [
  "topCenter",
  "topLeading",
  "topTrailing",
  "center",
  "bottomCenter",
  "bottomLeading",
  "bottomTrailing",
];

const DEFAULT_ICON: Record<ToastSemantic, string> = {
  error: "xmark.circle.fill",
  info: "info.circle.fill",
  none: "bubble.left.fill",
  success: "checkmark.circle.fill",
  warning: "exclamationmark.triangle.fill",
};

const DEFAULT_TINT: Record<ToastSemantic, string> = {
  error: mobileColors.systemError,
  info: "#0a84ff",
  none: "#8e8e93",
  success: "#30d158",
  warning: "#ff9f0a",
};

export function ToastViewport() {
  const insets = useSafeAreaInsets();
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  useEffect(() => {
    void engine.setDefaults({
      safeArea: { bottom: insets.bottom, top: insets.top },
    });
  }, [insets.bottom, insets.top]);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {POSITIONS.map((position) => {
        const toasts = snapshot.filter((item) => item.toast.position === position);
        if (toasts.length === 0) return null;
        return <ToastStack key={position} position={position} toasts={toasts} />;
      })}
    </View>
  );
}

function ToastStack({
  position,
  toasts,
}: {
  position: ToastPosition;
  toasts: readonly RenderToast[];
}) {
  const insets = useSafeAreaInsets();
  const config = engine.currentConfig;
  const isTop = position.startsWith("top");
  const isBottom = position.startsWith("bottom");
  const offset = isTop
    ? Math.max(insets.top, config.safeArea.top ?? 0) + 12
    : isBottom
      ? Math.max(insets.bottom, config.safeArea.bottom ?? 0) + 12
      : 0;
  const align = position.endsWith("Leading")
    ? "flex-start"
    : position.endsWith("Trailing")
      ? "flex-end"
      : "center";

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.stack,
        isTop && { justifyContent: "flex-start", top: offset },
        isBottom && { bottom: offset, justifyContent: "flex-end" },
        position === "center" && styles.centerStack,
        { alignItems: align },
      ]}
    >
      {toasts.map((item) => (
        <ToastCard item={item} key={item.id} />
      ))}
    </View>
  );
}

function ToastCard({ item }: { item: RenderToast }) {
  const { toast } = item;
  const isDark = useColorScheme() === "dark";
  const { width } = useWindowDimensions();
  const semantic = toast.semantic ?? "none";
  const multiline = Boolean(toast.title) || toast.message.length > 64;
  const radius = toast.style?.cornerRadius ?? (multiline ? 22 : 99);
  const background =
    resolveColor(toast.style?.background, isDark) ?? (isDark ? "#242424" : "#fafafa");
  const foreground =
    resolveColor(toast.style?.foreground, isDark) ?? (isDark ? "#f5f5f5" : "#1a1a1a");
  const tint = resolveColor(toast.style?.tint, isDark) ?? DEFAULT_TINT[semantic];
  const effect = toast.style?.glass === "none" ? "none" : "regular";
  const useGlass = shouldUseGlass(toast);
  const maxWidth = multiline ? Math.min(440, width - 40) : Math.min(340, width - 32);
  const surfaceStyle: StyleProp<ViewStyle> = [
    styles.surface,
    { backgroundColor: background, borderRadius: radius, maxWidth },
  ];

  useEffect(() => {
    triggerToastHaptic(toast);
  }, [toast]);

  const content = (
    <ToastCardContent
      foreground={foreground}
      isDark={isDark}
      item={item}
      multiline={multiline}
      surfaceStyle={surfaceStyle}
      tint={tint}
    />
  );

  return (
    <ToastAnimatedContainer id={item.id} onSwipe={() => void engine.dismiss(item.id, "swipe")}>
      {useGlass ? (
        <LiquidGlassContainerView spacing={0} style={styles.glassContainer}>
          <LiquidGlassView animated effect={effect} style={surfaceStyle}>
            {content}
          </LiquidGlassView>
        </LiquidGlassContainerView>
      ) : (
        content
      )}
    </ToastAnimatedContainer>
  );
}

type ToastCardContentProps = {
  foreground: string;
  isDark: boolean;
  item: RenderToast;
  multiline: boolean;
  surfaceStyle: StyleProp<ViewStyle>;
  tint: string;
};

function ToastCardContent({
  foreground,
  isDark,
  item,
  multiline,
  surfaceStyle,
  tint,
}: ToastCardContentProps) {
  const { toast } = item;

  return (
    <Pressable
      accessibilityLabel={
        toast.semanticsLabel ?? [toast.title, toast.message].filter(Boolean).join(", ")
      }
      accessibilityRole="alert"
      onPress={() => engine.tap(item.id)}
      style={surfaceStyle}
    >
      <View style={styles.row}>
        <Leading toast={toast} tint={tint} />
        <View style={styles.textColumn}>
          {toast.title ? (
            <Text
              numberOfLines={toast.titleMaxLines ?? 1}
              style={[styles.title, { color: foreground }]}
            >
              {toast.title}
            </Text>
          ) : null}
          <Text
            numberOfLines={toast.maxLines ?? (multiline ? 2 : 1)}
            style={[styles.message, { color: foreground }]}
          >
            {toast.message}
          </Text>
          {toast.progress !== undefined && toast.progressStyle !== "circular" ? (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressValue,
                  {
                    backgroundColor: tint,
                    width: `${Math.max(0, Math.min(1, toast.progress)) * 100}%`,
                  },
                ]}
              />
            </View>
          ) : null}
        </View>
        {toast.action ? (
          <Pressable
            accessibilityLabel={toast.action.label}
            accessibilityRole="button"
            disabled={item.actionLoading}
            onPress={() => engine.triggerAction(item.id, item.actionId)}
            style={({ pressed }) => [
              styles.action,
              {
                opacity: pressed ? 0.65 : 1,
                backgroundColor: resolveColor(toast.action?.color, isDark) ?? tint,
              },
            ]}
          >
            {item.actionLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.actionLabel}>{toast.action.label}</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function shouldUseGlass(toast: Toast): boolean {
  return Platform.OS === "ios" && isLiquidGlassSupported && toast.style?.glass !== "solid";
}

function triggerToastHaptic(toast: Toast): void {
  const haptic = hapticForToast(toast);
  if (Platform.OS !== "ios" || haptic === "none") return;
  const task =
    haptic === "success"
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : haptic === "error"
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        : haptic === "warning"
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          : Haptics.selectionAsync();
  void task.catch(() => undefined);
}

function ToastAnimatedContainer({
  children,
}: {
  children: ReactNode;
  id: string;
  onSwipe: () => void;
}) {
  return <View style={styles.cardContainer}>{children}</View>;
}

function Leading({ toast, tint }: { toast: Toast; tint: string }) {
  if (toast.loading) return <ActivityIndicator color={tint} size="small" style={styles.leading} />;
  if (toast.leadingImage) {
    return (
      <Image
        source={{ uri: `data:image/png;base64,${toast.leadingImage}` }}
        style={styles.avatar}
      />
    );
  }
  return (
    <Text style={[styles.icon, { color: tint }]}>
      {iconGlyph(toast.icon ?? DEFAULT_ICON[toast.semantic ?? "none"])}
    </Text>
  );
}

function iconGlyph(name: string): string {
  if (name.includes("checkmark")) return "✓";
  if (name.includes("xmark")) return "×";
  if (name.includes("warning") || name.includes("exclamation")) return "!";
  if (name.includes("info")) return "i";
  return "•";
}

function resolveColor(color: ToastColor | undefined, dark: boolean): string | undefined {
  if (!color) return undefined;
  const value = dark ? color.dark : color.light;
  return `#${(value >>> 0).toString(16).padStart(8, "0")}`;
}

const styles = StyleSheet.create({
  stack: {
    left: 0,
    paddingHorizontal: 16,
    position: "absolute",
    right: 0,
    zIndex: 100,
  },
  centerStack: { bottom: 0, justifyContent: "center", top: 0 },
  cardContainer: { marginBottom: 10, maxWidth: "100%" },
  glassContainer: { maxWidth: "100%" },
  surface: {
    borderColor: "rgba(255,255,255,0.16)",
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 11,
    width: "100%",
  },
  row: { alignItems: "center", flexDirection: "row", gap: 12 },
  leading: { height: 22, width: 22 },
  avatar: { borderRadius: 13, height: 26, width: 26 },
  icon: { ...FONT_STYLES.otp, height: 26, textAlign: "center", width: 26 },
  textColumn: { flex: 1, minWidth: 0 },
  title: {
    ...FONT_STYLES.bodyMedium,
    fontFamily: FONT_FAMILIES.inter.bold,
    fontWeight: FONT_WEIGHTS.bold,
  },
  message: FONT_STYLES.bodyMediumMedium,
  action: {
    borderRadius: 99,
    minHeight: 32,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    ...FONT_STYLES.bodySmall,
    color: "#fff",
    fontFamily: FONT_FAMILIES.inter.bold,
    fontWeight: FONT_WEIGHTS.bold,
  },
  progressTrack: {
    backgroundColor: "rgba(127,127,127,0.24)",
    borderRadius: 99,
    height: 3,
    marginTop: 8,
    overflow: "hidden",
    width: 160,
  },
  progressValue: { borderRadius: 99, height: "100%" },
});

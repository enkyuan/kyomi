import { BlurView } from "expo-blur";
import { Platform, Pressable, StyleSheet } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ActionMenuBackdropProps = {
  readonly isOpen: SharedValue<boolean>;
  readonly onDismiss: () => void;
  readonly shouldReduceMotion: boolean;
};

/** The full-screen material that absorbs outside taps while the menu is open. */
export function ActionMenuBackdrop({
  isOpen,
  onDismiss,
  shouldReduceMotion,
}: ActionMenuBackdropProps) {
  const animatedProps = useAnimatedProps(() => ({
    intensity: shouldReduceMotion ? (isOpen.value ? 75 : 0) : withTiming(isOpen.value ? 75 : 0),
  }));
  const androidStyle = useAnimatedStyle(() => ({
    opacity: shouldReduceMotion ? (isOpen.value ? 1 : 0) : withTiming(isOpen.value ? 1 : 0),
  }));

  if (Platform.OS === "android") {
    return (
      <AnimatedPressable
        accessibilityLabel="Dismiss actions menu"
        accessibilityRole="button"
        onPress={onDismiss}
        style={[StyleSheet.absoluteFill, styles.androidBackdrop, androidStyle]}
      />
    );
  }

  return (
    <Pressable
      accessibilityLabel="Dismiss actions menu"
      accessibilityRole="button"
      onPress={onDismiss}
      style={StyleSheet.absoluteFill}
    >
      <AnimatedBlurView animatedProps={animatedProps} style={StyleSheet.absoluteFill} tint="dark" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  androidBackdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.9)",
  },
});

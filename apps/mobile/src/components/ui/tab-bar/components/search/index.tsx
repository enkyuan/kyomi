import { StyleSheet, TextInput, View } from "react-native";
import {
  GestureDetector,
  type ComposedGesture,
  type GestureType,
} from "react-native-gesture-handler";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from "react-native-reanimated";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { FONT_STYLES } from "@/theme/fonts";
import {
  CLOSE_BUTTON_SIZE,
  COLORS,
  SEARCH_ICON_SIZE,
  PILL_HEIGHT,
  SEARCH_ACTIVE_HEIGHT,
  SEARCH_ACTIVE_RADIUS,
  SEARCH_BAR_RADIUS,
  SEARCH_BAR_WIDTH,
  SEARCH_BUTTON_SIZE,
  liquidGlassTransform,
} from "../../lib/constants";
import { GlassMaterial } from "../pill/glass-material";
import { GlowOverlay } from "../pill/glow-overlay";

// --- Search Button ---

const SEARCH_HALF_W = SEARCH_BUTTON_SIZE / 2;
const SEARCH_HALF_H = PILL_HEIGHT / 2;

interface SearchButtonProps {
  readonly composedGesture: ComposedGesture | GestureType;
  readonly glowProgress: SharedValue<number>;
  readonly isSearchActive: boolean;
  readonly onQueryChange?: (query: string) => void;
  readonly overflowX: SharedValue<number>;
  readonly overflowY: SharedValue<number>;
  readonly pressed: SharedValue<number>;
  readonly searchProgress: SharedValue<number>;
  readonly touchX: SharedValue<number>;
  readonly touchY: SharedValue<number>;
  readonly value?: string;
}

export function SearchButton({
  composedGesture,
  glowProgress,
  isSearchActive,
  onQueryChange,
  overflowX,
  overflowY,
  pressed,
  searchProgress,
  touchX,
  touchY,
  value,
}: SearchButtonProps) {
  const searchHeight = useDerivedValue(() =>
    interpolate(searchProgress.get(), [0, 1], [PILL_HEIGHT, SEARCH_ACTIVE_HEIGHT], "clamp"),
  );
  const searchRadius = useDerivedValue(() =>
    interpolate(searchProgress.get(), [0, 1], [SEARCH_BAR_RADIUS, SEARCH_ACTIVE_RADIUS], "clamp"),
  );

  const glassStyle = useAnimatedStyle(() =>
    liquidGlassTransform(
      pressed.get(),
      overflowX.get(),
      overflowY.get(),
      SEARCH_HALF_W,
      SEARCH_HALF_H,
    ),
  );

  const heightStyle = useAnimatedStyle(() => ({
    borderRadius: searchRadius.get(),
    height: searchHeight.get(),
  }));
  const wrapperStyle = useAnimatedStyle(() => ({
    width: interpolate(searchProgress.get(), [0, 1], [SEARCH_BUTTON_SIZE, SEARCH_BAR_WIDTH]),
  }));

  const inputOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(searchProgress.get(), [0.4, 0.8], [0, 1]),
  }));

  const iconStyle = useAnimatedStyle(() => ({
    left: interpolate(
      searchProgress.get(),
      [0, 1],
      [(SEARCH_BUTTON_SIZE - SEARCH_ICON_SIZE) / 2, 14],
    ),
    position: "absolute" as const,
    top: (searchHeight.get() - SEARCH_ICON_SIZE) / 2,
  }));

  return (
    <Animated.View style={[searchStyles.searchWrapper, wrapperStyle]}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={glassStyle}>
          <Animated.View style={[searchStyles.searchClip, heightStyle]}>
            <GlassMaterial
              borderRadius={SEARCH_BAR_RADIUS}
              style={[searchStyles.container, heightStyle]}
            >
              <Animated.View style={iconStyle}>
                <SearchIcon fill={COLORS.iconDefault} size={SEARCH_ICON_SIZE} />
              </Animated.View>
              <Animated.View style={[searchStyles.inputContainer, inputOpacity]}>
                <TextInput
                  clearButtonMode="while-editing"
                  onChangeText={onQueryChange}
                  placeholder="Search feeds or articles…"
                  placeholderTextColor={COLORS.textSecondary}
                  pointerEvents={isSearchActive ? "auto" : "none"}
                  returnKeyType="search"
                  selectionColor={COLORS.accentGreen}
                  style={searchStyles.input}
                  value={value}
                />
              </Animated.View>
            </GlassMaterial>
            <GlowOverlay
              glowProgress={glowProgress}
              id="searchGlow"
              size={120}
              touchX={touchX}
              touchY={touchY}
            />
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const searchStyles = StyleSheet.create({
  container: {
    justifyContent: "center",
    width: "100%",
  },
  input: {
    ...FONT_STYLES.bodyMedium,
    color: COLORS.textPrimary,
    height: "100%",
  },
  inputContainer: {
    flex: 1,
    marginLeft: 42,
    marginRight: 14,
  },
  searchClip: {
    overflow: "hidden",
    width: "100%",
  },
  searchWrapper: {
    flexShrink: 0,
    marginLeft: "auto",
  },
});

// --- Close Search Button ---

const CLOSE_HALF_W = CLOSE_BUTTON_SIZE / 2;
const CLOSE_HALF_H = CLOSE_BUTTON_SIZE / 2;

interface CloseSearchButtonProps {
  readonly composedGesture: ComposedGesture | GestureType;
  readonly glowProgress: SharedValue<number>;
  readonly overflowX: SharedValue<number>;
  readonly overflowY: SharedValue<number>;
  readonly pressed: SharedValue<number>;
  readonly searchProgress: SharedValue<number>;
  readonly touchX: SharedValue<number>;
  readonly touchY: SharedValue<number>;
}

export function CloseSearchButton({
  composedGesture,
  glowProgress,
  overflowX,
  overflowY,
  pressed,
  searchProgress,
  touchX,
  touchY,
}: CloseSearchButtonProps) {
  const closeHeight = useDerivedValue(() =>
    interpolate(searchProgress.get(), [0, 1], [PILL_HEIGHT, SEARCH_ACTIVE_HEIGHT], "clamp"),
  );

  const glassStyle = useAnimatedStyle(() =>
    liquidGlassTransform(
      pressed.get(),
      overflowX.get(),
      overflowY.get(),
      CLOSE_HALF_W,
      CLOSE_HALF_H,
    ),
  );

  const visibilityStyle = useAnimatedStyle(() => {
    const progress = searchProgress.get();
    return {
      transform: [
        { translateX: interpolate(progress, [0.3, 0.8], [20, 0], "clamp") },
        { scale: interpolate(progress, [0.3, 0.8], [0.5, 1], "clamp") },
      ],
      width: interpolate(progress, [0, 0.5], [0, SEARCH_ACTIVE_HEIGHT], "clamp"),
    };
  });

  const heightStyle = useAnimatedStyle(() => {
    const h = closeHeight.get();
    return {
      borderRadius: h / 2,
      height: h,
      width: h,
    };
  });

  return (
    <Animated.View style={[closeStyles.wrapper, visibilityStyle]}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[closeStyles.button, glassStyle, heightStyle]}>
          <GlassMaterial borderRadius={SEARCH_ACTIVE_RADIUS} style={closeStyles.material}>
            <View style={closeStyles.iconCenter}>
              <CloseIcon fill={COLORS.iconDefault} size={SEARCH_ICON_SIZE} />
            </View>
          </GlassMaterial>
          <GlowOverlay
            glowProgress={glowProgress}
            id="closeGlow"
            size={120}
            touchX={touchX}
            touchY={touchY}
          />
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const closeStyles = StyleSheet.create({
  wrapper: {
    overflow: "hidden",
  },
  button: {
    backgroundColor: COLORS.surfaceHover,
    borderColor: COLORS.border,
    borderWidth: 1,
    overflow: "hidden",
  },
  material: {
    flex: 1,
  },
  iconCenter: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
});

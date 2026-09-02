import { useEffect, useState } from "react";
import {
  Appearance as NativeAppearance,
  Platform,
  Pressable,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SymbolView } from "expo-symbols";
import Svg, { Circle, Path } from "react-native-svg";
import { createAppStorage } from "@lib/storage";
import { FONT_STYLES } from "@/theme/fonts";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { SettingsSection } from "./section";

const THEME_MODE_KEY = "mode";
const appearanceStorage = createAppStorage("appearance");

const THEME_OPTIONS = [
  { description: "Use device settings", label: "System", mode: "system" },
  { description: "Always use light mode.", label: "Light", mode: "light" },
  { description: "Always use dark mode.", label: "Dark", mode: "dark" },
] as const;

type ThemeMode = (typeof THEME_OPTIONS)[number]["mode"];

function readThemeMode(): ThemeMode {
  const stored = appearanceStorage.getString(THEME_MODE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function applyThemeMode(mode: ThemeMode) {
  if (Platform.OS === "web") {
    if (typeof document !== "undefined") {
      document.documentElement.style.colorScheme = mode === "system" ? "" : mode;
    }
    return;
  }

  NativeAppearance.setColorScheme(mode === "system" ? "unspecified" : mode);
}

export function AppearanceSection() {
  const colorScheme = useColorScheme();
  const theme = getMobileSurfaceTheme(colorScheme === "dark" ? "dark" : "light");
  const [mode, setMode] = useState<ThemeMode>(() => readThemeMode());

  useEffect(() => {
    applyThemeMode(mode);
  }, [mode]);

  return (
    <SettingsSection description="Customize how the app looks" header="Appearance">
      <View className="gap-3">
        {THEME_OPTIONS.map((option) => {
          const isSelected = option.mode === mode;

          return (
            <Pressable
              accessibilityLabel={`${option.label}: ${option.description}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              key={option.mode}
              onPress={() => {
                appearanceStorage.set(THEME_MODE_KEY, option.mode);
                setMode(option.mode);
              }}
              style={({ pressed }) => ({
                backgroundColor: theme.card,
                borderCurve: "continuous",
                borderRadius: 24,
                opacity: pressed ? 0.78 : 1,
              })}
            >
              <View className="min-h-24 flex-row items-center gap-4 p-3">
                <View className="w-18 overflow-hidden rounded-2xl" style={{ aspectRatio: 88 / 70 }}>
                  <ThemePreview mode={option.mode} />
                </View>
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="text-foreground" style={FONT_STYLES.compactTitle}>
                    {option.label}
                  </Text>
                  <Text style={{ ...FONT_STYLES.bodyMedium, color: theme.mutedForeground }}>
                    {option.description}
                  </Text>
                </View>
                {isSelected ? (
                  <SymbolView
                    accessibilityElementsHidden
                    name={{ android: "check", ios: "checkmark", web: "check" }}
                    size={20}
                    tintColor={theme.foreground}
                    weight="semibold"
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </SettingsSection>
  );
}

function ThemePreview({ mode }: { mode: ThemeMode }) {
  return (
    <Svg
      accessibilityElementsHidden
      fill="none"
      height="100%"
      importantForAccessibility="no-hide-descendants"
      viewBox="0 0 88 70"
      width="100%"
    >
      {mode === "system" ? (
        <>
          <Path d="M0 0h44v70H0z" fill="#e5e5e5" />
          <Path d="M44 0h44v70H44z" fill="#171717" />
          <Path d="M10 12a4 4 0 0 1 4-4h30v62H10V12Z" fill="#fff" />
          <Circle cx="28" cy="26" fill="#d4d4d4" r="8" />
          <Path
            d="M20 44a2 2 0 0 1 2-2h22v4H22a2 2 0 0 1-2-2ZM20 51a2 2 0 0 1 2-2h22v4H22a2 2 0 0 1-2-2ZM20 58a2 2 0 0 1 2-2h22v4H22a2 2 0 0 1-2-2Z"
            fill="#e5e5e5"
          />
          <Path d="M54 12a4 4 0 0 1 4-4h30v62H54V12Z" fill="#262626" />
          <Circle cx="72" cy="26" fill="#525252" r="8" />
          <Path
            d="M64 44a2 2 0 0 1 2-2h22v4H66a2 2 0 0 1-2-2ZM64 51a2 2 0 0 1 2-2h22v4H66a2 2 0 0 1-2-2ZM64 58a2 2 0 0 1 2-2h22v4H66a2 2 0 0 1-2-2Z"
            fill="#404040"
          />
        </>
      ) : (
        <>
          <Path d="M0 0h88v70H0z" fill={mode === "light" ? "#e5e5e5" : "#171717"} />
          <Path
            d="M10 12a4 4 0 0 1 4-4h74v62H10V12Z"
            fill={mode === "light" ? "#fff" : "#262626"}
          />
          <Circle cx="28" cy="26" fill={mode === "light" ? "#d4d4d4" : "#525252"} r="8" />
          <Path
            d="M20 44a2 2 0 0 1 2-2h58v4H22a2 2 0 0 1-2-2ZM20 51a2 2 0 0 1 2-2h58v4H22a2 2 0 0 1-2-2ZM20 58a2 2 0 0 1 2-2h29v4H22a2 2 0 0 1-2-2Z"
            fill={mode === "light" ? "#e5e5e5" : "#404040"}
          />
        </>
      )}
    </Svg>
  );
}

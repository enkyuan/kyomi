import { useColorScheme } from "react-native";
import { getMobileSurfaceTheme, type MobileSurfaceTheme } from "@/theme/surfaces";

type Theme = {
  colors: MobileSurfaceTheme;
  scheme: "dark" | "light";
};

export function useTheme(): Theme {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return { colors: getMobileSurfaceTheme(scheme), scheme };
}

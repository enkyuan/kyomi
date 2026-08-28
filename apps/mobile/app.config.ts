import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  scheme: "kyomi",
  userInterfaceStyle: "automatic",
  orientation: "default",
  web: {
    output: "static",
  },
  name: "Kyomi",
  slug: "kyomi",
  experiments: {
    reactCompiler: true,
  },
  plugins: ["expo-router", "expo-secure-store", "expo-web-browser", "expo-font"],
  android: {
    package: "com.anonymous.mobile",
  },
  ios: {
    bundleIdentifier: "com.anonymous.mobile",
    deploymentTarget: "17.0",
    infoPlist: {
      UIDesignRequiresCompatibility: false,
      UIViewControllerBasedStatusBarAppearance: true,
    },
  },
});

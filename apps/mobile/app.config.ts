import type { ConfigContext, ExpoConfig } from "expo/config";

const localNetworkInfoPlist = process.env.EXPO_PUBLIC_AUTH_ORIGIN?.trim().startsWith("http://")
  ? {
      NSLocalNetworkUsageDescription:
        "Kyomi connects to your local development server during development.",
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
      },
    }
  : {};

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
      ...localNetworkInfoPlist,
    },
  },
});

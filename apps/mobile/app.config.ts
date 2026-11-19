import type { ConfigContext, ExpoConfig } from "expo/config";

// Dev builds reach Metro and the API over plain HTTP on the local network, whichever host
// Metro was loaded from, so this no longer depends on a build-time origin.
const localNetworkInfoPlist = {
  NSLocalNetworkUsageDescription:
    "Kyomi connects to your local development server during development.",
  NSBonjourServices: ["_expo._tcp"],
  NSAppTransportSecurity: {
    NSAllowsLocalNetworking: true,
    // Tailscale MagicDNS hosts (Metro and the API over a tailnet) are not "local" to ATS.
    NSExceptionDomains: {
      "ts.net": {
        NSIncludesSubdomains: true,
        NSExceptionAllowsInsecureHTTPLoads: true,
      },
    },
  },
};

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
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-web-browser",
    "expo-font",
    "expo-image",
    "expo-dev-client",
    "expo-splash-screen",
  ],
  android: {
    package: "com.anonymous.mobile",
  },
  ios: {
    bundleIdentifier: "com.anonymous.mobile",
    deploymentTarget: "26.0",
    infoPlist: {
      UIDesignRequiresCompatibility: false,
      UIViewControllerBasedStatusBarAppearance: true,
      ...localNetworkInfoPlist,
    },
  },
});

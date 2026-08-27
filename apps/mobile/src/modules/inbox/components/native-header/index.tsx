import { Platform } from "react-native";

type InboxNativeHeaderProps = {
  collapseProgress: number;
  topInset: number;
};

export function InboxNativeHeader(props: InboxNativeHeaderProps) {
  if (Platform.OS !== "ios") return null;

  const { InboxNativeHeader: NativeInboxHeader } =
    require("./index.ios") as typeof import("./index.ios");

  return <NativeInboxHeader {...props} />;
}

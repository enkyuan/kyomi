import { KyomiNativeHeaderViewProps } from "./KyomiNativeHeader.types";

// KyomiNativeHeaderView is not available on the web platform.
export default function KyomiNativeHeaderView(_props: KyomiNativeHeaderViewProps) {
  throw new Error("KyomiNativeHeaderView is not available on the web platform.");
}

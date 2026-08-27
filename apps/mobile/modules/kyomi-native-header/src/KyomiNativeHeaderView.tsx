import { requireNativeView } from "expo";
import type * as React from "react";
import type { KyomiNativeHeaderViewProps } from "./KyomiNativeHeader.types";

const NativeView = requireNativeView<KyomiNativeHeaderViewProps>("KyomiNativeHeader");

export default function KyomiNativeHeaderView(props: KyomiNativeHeaderViewProps) {
  return <NativeView {...props} />;
}

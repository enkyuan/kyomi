import { requireNativeView } from "expo";
import type { HeaderViewProps } from "./Header.types";

const NativeView = requireNativeView<HeaderViewProps>("Header");

export default function HeaderView(props: HeaderViewProps) {
  return <NativeView {...props} />;
}

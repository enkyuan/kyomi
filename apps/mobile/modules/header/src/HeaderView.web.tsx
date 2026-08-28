import type { HeaderViewProps } from "./Header.types";

// HeaderView is not available on the web platform.
export default function HeaderView(_props: HeaderViewProps) {
  throw new Error("HeaderView is not available on the web platform.");
}

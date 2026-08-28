import type { ReactNode } from "react";
import { Text, View, type TextStyle, type ViewProps } from "react-native";
import { FONT_STYLES } from "@/theme/fonts";

export type BadgeVariant =
  | "default"
  | "destructive"
  | "error"
  | "info"
  | "matcha"
  | "mizu"
  | "outline"
  | "secondary"
  | "success"
  | "warning";

export type BadgeSize = "default" | "lg" | "sm" | "xs";

const BASE_CLASS =
  "shrink-0 items-center justify-center overflow-hidden rounded-full border border-transparent";
const SIZE_CLASS: Record<BadgeSize, string> = {
  default: "h-[26px] min-w-6.5 px-1.5",
  lg: "h-[30px] min-w-7.5 px-2",
  sm: "h-[22px] min-w-7 px-2",
  xs: "h-[14px] min-w-6 px-1.5",
};

const TEXT_STYLE: Record<BadgeSize, TextStyle> = {
  default: FONT_STYLES.badgeDefault,
  lg: FONT_STYLES.badgeLarge,
  sm: FONT_STYLES.badgeSmall,
  xs: FONT_STYLES.badgeExtraSmall,
};

const VARIANT_CLASS: Record<BadgeVariant, { container: string; text: string }> = {
  default: { container: "bg-primary", text: "text-primary-foreground" },
  destructive: { container: "bg-destructive", text: "text-white" },
  error: {
    container: "bg-destructive/8 dark:bg-destructive/16",
    text: "text-destructive-foreground",
  },
  info: { container: "bg-info/8 dark:bg-info/16", text: "text-info-foreground" },
  matcha: {
    container: "bg-matcha/8 dark:bg-matcha/16",
    text: "text-matcha-foreground dark:text-matcha",
  },
  mizu: { container: "bg-mizu/8 dark:bg-mizu/16", text: "text-mizu-foreground" },
  outline: { container: "border-input bg-background dark:bg-input/32", text: "text-foreground" },
  secondary: { container: "bg-secondary", text: "text-secondary-foreground" },
  success: {
    container: "bg-success/8 dark:bg-success/16",
    text: "text-success-foreground",
  },
  warning: {
    container: "bg-warning/8 dark:bg-warning/16",
    text: "text-warning-foreground",
  },
};

type BadgeSharedProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly size?: BadgeSize;
  readonly textClassName?: string;
  readonly variant?: BadgeVariant;
};

export type BadgeProps = BadgeSharedProps & Omit<ViewProps, keyof BadgeSharedProps | "children">;

export function Badge({
  accessibilityLabel,
  children,
  className,
  size = "default",
  textClassName,
  variant = "default",
  ...props
}: BadgeProps) {
  const variantClasses = VARIANT_CLASS[variant];

  return (
    <View
      accessible={accessibilityLabel ? true : undefined}
      accessibilityLabel={accessibilityLabel}
      className={[BASE_CLASS, SIZE_CLASS[size], variantClasses.container, className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <Text
        className={[variantClasses.text, textClassName].filter(Boolean).join(" ")}
        style={[TEXT_STYLE[size], { includeFontPadding: false, textAlignVertical: "center" }]}
      >
        {children}
      </Text>
    </View>
  );
}

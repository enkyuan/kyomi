import { useId } from "react";
import { useColorScheme } from "react-native";
import { Defs, LinearGradient, Rect, Stop, Svg, type SvgProps } from "react-native-svg";
import { getEmptyStateTheme, type SceneContext } from "./empty-state-scenes/parts";
import { SCENES, type EmptyStateScene } from "./empty-state-scenes";

export type { EmptyStateScene };

export type EmptyStateIconProps = Omit<SvgProps, "width" | "height"> & {
  /** Which illustration to draw inside the dashed circle. */
  scene: EmptyStateScene;
  size?: number;
};

type EmptyStateIllustrationProps = EmptyStateIconProps & {
  isDarkTheme: boolean;
};

/**
 * The frame every empty state shares: the dashed circle on a 192-unit canvas and the gradient
 * paints the scenes draw their paper with. The scene itself lives in `empty-state-scenes`.
 */
function EmptyStateIllustration({
  scene,
  size = 176,
  isDarkTheme,
  ...props
}: EmptyStateIllustrationProps) {
  const id = useId().replaceAll(":", "");
  const backGradientId = `empty-state-back-${id}`;
  const frontGradientId = `empty-state-front-${id}`;
  const strokeGradientId = `empty-state-stroke-${id}`;
  const theme = getEmptyStateTheme(isDarkTheme);
  const context: SceneContext = {
    theme,
    paints: {
      back: `url(#${backGradientId})`,
      fill: `url(#${frontGradientId})`,
      stroke: `url(#${strokeGradientId})`,
    },
  };

  return (
    <Svg
      accessibilityElementsHidden
      fill="none"
      height={size}
      importantForAccessibility="no-hide-descendants"
      viewBox="0 0 192 192"
      width={size}
      {...props}
    >
      <Rect
        fill={theme.background}
        fillOpacity={theme.backgroundOpacity}
        height={isDarkTheme ? 192 : 191.5}
        rx={isDarkTheme ? 96 : 95.75}
        width={isDarkTheme ? 192 : 191.5}
        x={isDarkTheme ? 0 : 0.25}
        y={isDarkTheme ? 0 : 0.25}
      />
      <Rect
        fill="none"
        height={isDarkTheme ? 191 : 191.5}
        rx={isDarkTheme ? 95.5 : 95.75}
        stroke={theme.border}
        strokeDasharray="10 10"
        strokeLinecap="round"
        strokeOpacity={theme.borderOpacity}
        strokeWidth={isDarkTheme ? 1 : 0.5}
        width={isDarkTheme ? 191 : 191.5}
        x={isDarkTheme ? 0.5 : 0.25}
        y={isDarkTheme ? 0.5 : 0.25}
      />
      {SCENES[scene](context)}
      <Defs>
        <LinearGradient
          gradientUnits="userSpaceOnUse"
          id={backGradientId}
          x1="91.07"
          x2="99.96"
          y1="44.92"
          y2="146.534"
        >
          <Stop offset="0" stopColor="white" stopOpacity={theme.paperOpacity} />
          <Stop offset="1" stopColor="white" stopOpacity={theme.paperOpacity / 2} />
        </LinearGradient>
        <LinearGradient
          gradientUnits="userSpaceOnUse"
          id={frontGradientId}
          x1="99.96"
          x2="91.07"
          y1="44.922"
          y2="146.534"
        >
          <Stop offset="0" stopColor="white" stopOpacity={theme.paperOpacity} />
          <Stop offset="1" stopColor="white" stopOpacity={theme.paperOpacity / 2} />
        </LinearGradient>
        <LinearGradient
          gradientUnits="userSpaceOnUse"
          id={strokeGradientId}
          x1="99.96"
          x2="91.07"
          y1="44.922"
          y2="146.534"
        >
          <Stop offset="0" stopColor={theme.edge.from} stopOpacity={theme.edge.fromOpacity} />
          <Stop offset="1" stopColor={theme.edge.to} stopOpacity={theme.edge.toOpacity} />
        </LinearGradient>
      </Defs>
    </Svg>
  );
}

export function EmptyStateIcon(props: EmptyStateIconProps) {
  return <EmptyStateIllustration {...props} isDarkTheme={useColorScheme() !== "light"} />;
}

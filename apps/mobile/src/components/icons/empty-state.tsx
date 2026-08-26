import { useId } from "react";
import { useColorScheme } from "react-native";
import { Defs, G, LinearGradient, Path, Rect, Stop, Svg, type SvgProps } from "react-native-svg";

export type EmptyStateIconProps = Omit<SvgProps, "width" | "height"> & {
  size?: number;
};

type EmptyStateIllustrationProps = EmptyStateIconProps & {
  isDarkTheme: boolean;
};

function EmptyStateIllustration({
  size = 176,
  isDarkTheme,
  ...props
}: EmptyStateIllustrationProps) {
  const id = useId().replaceAll(":", "");
  const backGradientId = `empty-state-back-${id}`;
  const frontGradientId = `empty-state-front-${id}`;
  const strokeGradientId = `empty-state-stroke-${id}`;
  const theme = isDarkTheme
    ? {
        background: "#141414",
        backgroundOpacity: 0.25,
        border: "white",
        borderOpacity: 0.15,
        icon: "white",
        iconOpacity: 0.3,
        lines: ["white", "white", "white", "white"],
        lineOpacities: [0.1, 0.075, 0.05, 0.025],
        paperOpacity: 0.1,
      }
    : {
        background: "#FAFAFA",
        backgroundOpacity: 1,
        border: "#DBDBDB",
        borderOpacity: 1,
        icon: "#09244B",
        iconOpacity: 1,
        lines: ["#E7E7E7", "#F0F0F0", "#F6F6F6", "#FAFAFA"],
        lineOpacities: [1, 1, 1, 1],
        paperOpacity: 1,
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
      <G opacity={0.5}>
        <Path
          d="M47.44 56.77C47.07 52.64 50.13 49.01 54.25 48.64L127.97 42.2C132.1 41.83 135.74 44.89 136.1 49.01L143.59 134.69C143.95 138.81 140.9 142.45 136.78 142.81L63.06 149.26C58.93 149.62 55.29 146.57 54.93 142.44L47.44 56.77Z"
          fill={`url(#${backGradientId})`}
        />
      </G>
      <G>
        <Path
          d="M54.43 48.97C54.82 44.57 58.7 41.31 63.1 41.7L136.82 48.15C141.22 48.53 144.47 52.41 144.09 56.81L136.59 142.49C136.21 146.89 132.33 150.14 127.93 149.76L54.21 143.31C49.81 142.92 46.55 139.04 46.94 134.64L54.43 48.97Z"
          fill={`url(#${frontGradientId})`}
        />
        <Path
          d="M18 3a3 3 0 0 1 2.995 2.824L21 6v12a3 3 0 0 1-2.824 2.995L18 21H6a3 3 0 0 1-2.995-2.824L3 18V6a3 3 0 0 1 2.824-2.995L6 3zM8.5 14a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M8 10.5a1 1 0 1 0 0 2 3.5 3.5 0 0 1 3.5 3.5 1 1 0 1 0 2 0A5.5 5.5 0 0 0 8 10.5M8.5 7c-.19 0-.379.006-.566.019a1 1 0 0 0 .132 1.995 6.5 6.5 0 0 1 6.92 6.92 1 1 0 1 0 1.995.132A8.5 8.5 0 0 0 8.5 7"
          fill={theme.icon}
          fillOpacity={theme.iconOpacity}
          transform="translate(62.4 49.67) rotate(5) scale(.67)"
        />
        <Path
          d="M59.29 85.28C59.47 83.22 61.28 81.69 63.35 81.87L113.16 86.23C115.22 86.41 116.75 88.23 116.57 90.29C116.39 92.36 114.57 93.88 112.5 93.7L62.69 89.34C60.63 89.16 59.11 87.34 59.29 85.28Z"
          fill={theme.lines[0]}
          fillOpacity={theme.lineOpacities[0]}
        />
        <Path
          d="M57.93 100.72C58.12 98.66 59.93 97.13 62 97.31L128.24 103.11C130.31 103.29 131.83 105.11 131.65 107.17C131.47 109.24 129.65 110.76 127.59 110.58L61.34 104.79C59.28 104.6 57.75 102.79 57.93 100.72Z"
          fill={theme.lines[1]}
          fillOpacity={theme.lineOpacities[1]}
        />
        <Path
          d="M56.58 116.16C56.76 114.1 58.58 112.57 60.65 112.76L120.22 117.97C122.28 118.15 123.81 119.97 123.63 122.03C123.45 124.09 121.63 125.62 119.56 125.44L59.99 120.23C57.93 120.05 56.4 118.23 56.58 116.16Z"
          fill={theme.lines[2]}
          fillOpacity={theme.lineOpacities[2]}
        />
        <Path
          d="M55.23 131.6C55.41 129.54 57.23 128.01 59.3 128.19L96.65 131.46C98.72 131.64 100.24 133.46 100.06 135.53C99.88 137.59 98.06 139.11 96 138.93L58.64 135.67C56.58 135.49 55.05 133.67 55.23 131.6Z"
          fill={theme.lines[3]}
          fillOpacity={theme.lineOpacities[3]}
        />
        <Path
          d="M54.93 49.01C55.29 44.89 58.93 41.83 63.05 42.2L136.77 48.64C140.9 49.01 143.95 52.64 143.59 56.77L136.1 142.44C135.74 146.57 132.1 149.62 127.97 149.26L54.25 142.81C50.13 142.45 47.07 138.81 47.43 134.69L54.93 49.01Z"
          stroke={`url(#${strokeGradientId})`}
          strokeLinecap="round"
        />
      </G>
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
          <Stop offset="0" stopColor="white" stopOpacity={0.1} />
          <Stop offset="1" stopColor="#323232" stopOpacity={0} />
        </LinearGradient>
      </Defs>
    </Svg>
  );
}

export function EmptyStateIcon(props: EmptyStateIconProps) {
  return <EmptyStateIllustration {...props} isDarkTheme={useColorScheme() !== "light"} />;
}

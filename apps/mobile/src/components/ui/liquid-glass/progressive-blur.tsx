import MaskedView from "@react-native-masked-view/masked-view";
import { BlurView } from "expo-blur";
import { StyleSheet, View, ViewProps } from "react-native";

/** Shared falloff beyond floating navigation chrome. */
export const CHROME_BLUR_BLEED = 44;

type Props = ViewProps & {
  /** Blur strength at the anchored edge. */
  intensity?: number;
  /** Which edge the blur is anchored to (strongest there, fading away). */
  direction?: "top" | "bottom";
  /** Blur material + gradient color scheme. */
  tint?: "light" | "dark";
};

/**
 * Progressive (gradient) blur: one BlurView alpha-masked by an eased
 * gradient, so the material fades continuously with no layer seams —
 * full strength through the first 30%, easing to nothing at the far
 * edge. A soft gradient scrim keeps overlaid chrome legible.
 */
export function ProgressiveBlur({
  style,
  intensity = 40,
  direction = "top",
  tint = "dark",
  ...rest
}: Props) {
  const toEdge = direction === "top" ? "bottom" : "top";
  const rgb = tint === "dark" ? "0,0,0" : "255,255,255";

  return (
    <View pointerEvents="none" style={style} {...rest}>
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <View
            style={{
              flex: 1,
              experimental_backgroundImage: `linear-gradient(to ${toEdge}, rgb(0,0,0) 0%, rgb(0,0,0) 30%, rgba(0,0,0,0.95) 45%, rgba(0,0,0,0.82) 58%, rgba(0,0,0,0.62) 70%, rgba(0,0,0,0.38) 81%, rgba(0,0,0,0.16) 91%, rgba(0,0,0,0) 100%)`,
            }}
          />
        }
      >
        <BlurView tint={tint} intensity={intensity} style={StyleSheet.absoluteFill} />
      </MaskedView>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          experimental_backgroundImage: `linear-gradient(to ${toEdge}, rgba(${rgb},0.70) 0%, rgba(${rgb},0.32) 42%, rgba(${rgb},0.08) 68%, rgba(${rgb},0) 88%)`,
        }}
      />
    </View>
  );
}

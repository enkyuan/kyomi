import { MailIconGeometry } from "@kyomi/ui/icons/mail";
import Svg, { Path, type SvgProps } from "react-native-svg";

export type EnvelopeIconProps = Omit<SvgProps, "width" | "height"> & {
  size?: number;
};

export function EnvelopeIcon({ size = 20, fill = "currentColor", ...props }: EnvelopeIconProps) {
  return (
    <Svg
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      height={size}
      viewBox={MailIconGeometry.viewBox}
      width={size}
      {...props}
    >
      {MailIconGeometry.paths.map((path) => (
        <Path d={path.d} fill={fill} key={path.d} />
      ))}
    </Svg>
  );
}

import * as React from "react";

export interface KyomiLogoProps extends Omit<React.SVGProps<SVGSVGElement>, "width" | "height"> {
  size?: number;
}

export function KyomiLogo({
  size = 24,
  className,
  fill = "oklch(0.819 0.121 131.147)",
  ...props
}: KyomiLogoProps): React.ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 656 646"
      fill="none"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M306.9 6.58C305.21 10.38 309.43 28.12 315.77 45.45C340.27 110.5 348.72 150.64 347.03 189.5C344.92 231.75 335.62 252.87 309.85 275.26C280.28 300.61 248.18 308.21 151.44 312.44C41.18 317.51 26.81 321.73 11.18 351.73C-4.87 382.99 -3.18 589.57 13.3 611.54C36.11 642.38 61.45 647.45 183.12 644.91C279.02 642.8 290.84 640.69 310.7 621.68C325.06 608.16 329.71 579.85 332.67 493.67C335.2 418.48 343.65 382.99 366.04 353.42C408.71 297.65 480.1 291.32 596.27 332.72C638.52 347.92 644.01 349.19 649.92 343.28C657.95 334.83 658.37 337.36 644.01 297.65C608.52 200.91 608.95 143.88 645.28 42.91C663.02 -6.52 657.11 -9.47 588.25 15.03C544.74 31.08 543.86 42.91 481.34 42.91C419.24 42.91 416.73 30.66 371.95 15.03C320.84 -2.29 310.7 -3.98 306.9 6.58Z"
        fill={fill}
      />
    </svg>
  );
}

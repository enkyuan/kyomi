import * as React from "react";

export interface KyomiLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export function KyomiLogo({
  size,
  width,
  height,
  className,
  fill = "#A8D480",
  ...props
}: KyomiLogoProps): React.ReactElement {
  const resolvedWidth = size ?? width ?? 24;
  const resolvedHeight = size ?? height ?? 24;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={resolvedWidth}
      height={resolvedHeight}
      viewBox="0 0 656 646"
      fill="none"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M306.897 6.57935C305.207 10.3815 309.432 28.1246 315.768 45.4454C340.27 110.504 348.719 150.637 347.029 189.503C344.917 231.749 335.623 252.872 309.854 275.262C280.283 300.609 248.177 308.213 151.436 312.438C41.1774 317.507 26.8142 321.732 11.1836 351.726C-4.86936 382.988 -3.17957 589.569 13.2959 611.537C36.108 642.376 61.4549 647.446 183.12 644.911C279.015 642.799 290.844 640.687 310.699 621.676C325.062 608.157 329.709 579.853 332.666 493.672C335.201 418.475 343.65 382.988 366.039 353.416C408.707 297.652 480.1 291.315 596.273 332.716C638.518 347.924 644.01 349.192 649.924 343.277C657.951 334.828 658.373 337.363 644.01 297.652C608.524 200.909 608.947 143.878 645.277 42.9106C663.02 -6.51678 657.106 -9.474 588.247 15.0285C544.735 31.0818 543.861 42.9106 481.339 42.9106C419.239 42.9106 416.733 30.6594 371.954 15.0285C320.838 -2.29224 310.699 -3.98206 306.897 6.57935Z"
        fill={fill}
      />
    </svg>
  );
}

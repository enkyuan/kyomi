"use client";

import { useLayoutEffect, useId, useState } from "react";

export interface EmptyStateProps {
  width?: number;
  height?: number;
  className?: string;
}

interface EmptyStateBaseProps extends EmptyStateProps {
  isDarkTheme?: boolean;
}

const EMPTY_STATE_THEMES = {
  dark: {
    viewBox: "0 0 192 192",
    bgFill: "#141414",
    bgOpacity: "0.25",
    borderColor: "white",
    borderOpacity: "0.15",
    borderWidth: "1",
    rssIconFill: "white",
    rssIconOpacity: "0.3",
    lineColors: ["white", "white", "white", "white"],
    lineOpacities: ["0.1", "0.075", "0.05", "0.025"],
    paint0Stop0Opacity: "0.1",
    paint0Stop1Opacity: "0.05",
    paint2Stop0Opacity: "0.1",
    paint2Stop1Opacity: "0.05",
  },
  light: {
    viewBox: "0 0 192 198",
    bgFill: "#FAFAFA",
    bgOpacity: "1",
    borderColor: "#DBDBDB",
    borderOpacity: "1",
    borderWidth: "0.5",
    rssIconFill: "#09244B",
    rssIconOpacity: "1",
    lineColors: ["#E7E7E7", "#F0F0F0", "#F6F6F6", "#FAFAFA"],
    lineOpacities: ["1", "1", "1", "1"],
    paint0Stop0Opacity: "1",
    paint0Stop1Opacity: "1",
    paint2Stop0Opacity: "1",
    paint2Stop1Opacity: "1",
  },
} as const;

function useResolvedTheme() {
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">(() => {
    if (typeof document === "undefined") {
      return "dark";
    }
    const root = document.documentElement;
    const dataTheme = root.getAttribute("data-theme");
    if (root.classList.contains("dark") || dataTheme === "dark") {
      return "dark";
    }
    if (root.classList.contains("light") || dataTheme === "light") {
      return "light";
    }
    return "dark";
  });

  useLayoutEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const getTheme = () => {
      const dataTheme = root.getAttribute("data-theme");
      if (root.classList.contains("dark") || dataTheme === "dark") {
        return "dark" as const;
      }
      if (root.classList.contains("light") || dataTheme === "light") {
        return "light" as const;
      }
      return "dark" as const;
    };
    const updateTheme = () => {
      setResolvedTheme(getTheme());
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(root, {
      attributeFilter: ["class", "data-theme"],
      attributes: true,
    });

    mediaQuery.addEventListener("change", updateTheme);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", updateTheme);
    };
  }, []);

  return resolvedTheme;
}

const EmptyStateBase = ({
  width = 200,
  height = 200,
  className,
  isDarkTheme = true,
}: EmptyStateBaseProps) => {
  const id = useId().replace(/:/g, "");
  const theme = EMPTY_STATE_THEMES[isDarkTheme ? "dark" : "light"];

  const filter0Id = `filter0_dd_${id}`;
  const filter1Id = `filter1_dd_${id}`;
  const paint0Id = `paint0_linear_${id}`;
  const paint1Id = `paint1_linear_${id}`;
  const paint2Id = `paint2_linear_${id}`;
  const paint3Id = `paint3_linear_${id}`;
  const clip0Id = `clip0_${id}`;
  const clip1Id = `clip1_${id}`;

  const filterElements = !isDarkTheme ? (
    <>
      <filter
        id={filter0Id}
        x="22.24"
        y="17"
        width="146.548"
        height="157.455"
        filterUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix" />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feMorphology
          radius="0.5"
          operator="dilate"
          in="SourceAlpha"
          result="effect1_dropShadow_3099_2693"
        />
        <feOffset />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.86 0 0 0 0 0.86 0 0 0 0 0.86 0 0 0 1 0" />
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_3099_2693" />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset dy="1" />
        <feGaussianBlur stdDeviation="1" />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0" />
        <feBlend
          mode="normal"
          in2="effect1_dropShadow_3099_2693"
          result="effect2_dropShadow_3099_2693"
        />
        <feBlend
          mode="normal"
          in="SourceGraphic"
          in2="effect2_dropShadow_3099_2693"
          result="shape"
        />
      </filter>
      <filter
        id={filter1Id}
        x="14.24"
        y="17"
        width="162.547"
        height="181.455"
        filterUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix" />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feMorphology
          radius="0.5"
          operator="dilate"
          in="SourceAlpha"
          result="effect1_dropShadow_3099_2693"
        />
        <feOffset />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.86 0 0 0 0 0.86 0 0 0 0 0.86 0 0 0 1 0" />
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_3099_2693" />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset dy="16" />
        <feGaussianBlur stdDeviation="16" />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0" />
        <feBlend
          mode="normal"
          in2="effect1_dropShadow_3099_2693"
          result="effect2_dropShadow_3099_2693"
        />
        <feBlend
          mode="normal"
          in="SourceGraphic"
          in2="effect2_dropShadow_3099_2693"
          result="shape"
        />
      </filter>
    </>
  ) : null;

  const clipFill = "white";

  const paint0Stop0Color = "white";
  const paint0Stop1Color = "white";

  const paint1Stop0Color = "white";
  const paint1Stop0Opacity = "0.1";
  const paint1Stop1Color = "#323232";
  const paint1Stop1Opacity = "0";

  const paint2Stop0Color = "white";
  const paint2Stop1Color = "white";

  return (
    <svg
      width={width}
      height={height}
      viewBox={theme.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {isDarkTheme ? (
        <rect width="192" height="192" rx="96" fill={theme.bgFill} fillOpacity={theme.bgOpacity} />
      ) : (
        <rect x="0.25" y="0.25" width="191.5" height="191.5" rx="95.75" fill={theme.bgFill} />
      )}

      {isDarkTheme ? (
        <rect
          x="0.5"
          y="0.5"
          width="191"
          height="191"
          rx="95.5"
          stroke={theme.borderColor}
          strokeOpacity={theme.borderOpacity}
          strokeLinecap="round"
          strokeDasharray="10 10"
        />
      ) : (
        <rect
          x="0.25"
          y="0.25"
          width="191.5"
          height="191.5"
          rx="95.75"
          stroke={theme.borderColor}
          strokeWidth={theme.borderWidth}
          strokeLinecap="round"
          strokeDasharray="10 10"
        />
      )}

      <g opacity="0.5" filter={!isDarkTheme ? `url(#${filter0Id})` : undefined}>
        <path
          d="M47.44 56.77C47.07 52.64 50.13 49.01 54.25 48.64L127.97 42.2C132.1 41.83 135.74 44.89 136.1 49.01L143.59 134.69C143.95 138.81 140.9 142.45 136.78 142.81L63.06 149.26C58.93 149.62 55.29 146.57 54.93 142.44L47.44 56.77Z"
          fill={`url(#${paint0Id})`}
        />
        <path
          d="M47.44 56.77C47.07 52.64 50.13 49.01 54.25 48.64L127.97 42.2C132.1 41.83 135.74 44.89 136.1 49.01L143.59 134.69C143.95 138.81 140.9 142.45 136.78 142.81L63.06 149.26C58.93 149.62 55.29 146.57 54.93 142.44L47.44 56.77Z"
          stroke={`url(#${paint1Id})`}
          strokeLinecap="round"
        />
      </g>

      <g filter={!isDarkTheme ? `url(#${filter1Id})` : undefined}>
        <g clipPath={`url(#${clip0Id})`}>
          <path
            d="M54.43 48.97C54.82 44.57 58.7 41.31 63.1 41.7L136.82 48.15C141.22 48.53 144.47 52.41 144.09 56.81L136.59 142.49C136.21 146.89 132.33 150.14 127.93 149.76L54.21 143.31C49.81 142.92 46.55 139.04 46.94 134.64L54.43 48.97Z"
            fill={`url(#${paint2Id})`}
          />

          <g clipPath={`url(#${clip1Id})`}>
            <g transform="translate(62.4 49.67) rotate(5) scale(0.67)">
              <path
                d="M18 3a3 3 0 0 1 2.995 2.824L21 6v12a3 3 0 0 1-2.824 2.995L18 21H6a3 3 0 0 1-2.995-2.824L3 18V6a3 3 0 0 1 2.824-2.995L6 3zM8.5 14a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M8 10.5a1 1 0 1 0 0 2 3.5 3.5 0 0 1 3.5 3.5 1 1 0 1 0 2 0A5.5 5.5 0 0 0 8 10.5M8.5 7c-.19 0-.379.006-.566.019a1 1 0 0 0 .132 1.995 6.5 6.5 0 0 1 6.92 6.92 1 1 0 1 0 1.995.132A8.5 8.5 0 0 0 8.5 7"
                fill={theme.rssIconFill}
                fillOpacity={theme.rssIconOpacity}
              />
            </g>
          </g>

          <path
            d="M59.29 85.28C59.47 83.22 61.28 81.69 63.35 81.87L113.16 86.23C115.22 86.41 116.75 88.23 116.57 90.29C116.39 92.36 114.57 93.88 112.5 93.7L62.69 89.34C60.63 89.16 59.11 87.34 59.29 85.28Z"
            fill={theme.lineColors[0]}
            fillOpacity={theme.lineOpacities[0]}
          />
          <path
            d="M57.93 100.72C58.12 98.66 59.93 97.13 62 97.31L128.24 103.11C130.31 103.29 131.83 105.11 131.65 107.17C131.47 109.24 129.65 110.76 127.59 110.58L61.34 104.79C59.28 104.6 57.75 102.79 57.93 100.72Z"
            fill={theme.lineColors[1]}
            fillOpacity={theme.lineOpacities[1]}
          />
          <path
            d="M56.58 116.16C56.76 114.1 58.58 112.57 60.65 112.76L120.22 117.97C122.28 118.15 123.81 119.97 123.63 122.03C123.45 124.09 121.63 125.62 119.56 125.44L59.99 120.23C57.93 120.05 56.4 118.23 56.58 116.16Z"
            fill={theme.lineColors[2]}
            fillOpacity={theme.lineOpacities[2]}
          />
          <path
            d="M55.23 131.6C55.41 129.54 57.23 128.01 59.3 128.19L96.65 131.46C98.72 131.64 100.24 133.46 100.06 135.53C99.88 137.59 98.06 139.11 96 138.93L58.64 135.67C56.58 135.49 55.05 133.67 55.23 131.6Z"
            fill={theme.lineColors[3]}
            fillOpacity={theme.lineOpacities[3]}
          />
        </g>

        <path
          d="M54.93 49.01C55.29 44.89 58.93 41.83 63.05 42.2L136.77 48.64C140.9 49.01 143.95 52.64 143.59 56.77L136.1 142.44C135.74 146.57 132.1 149.62 127.97 149.26L54.25 142.81C50.13 142.45 47.07 138.81 47.43 134.69L54.93 49.01Z"
          stroke={`url(#${paint3Id})`}
          strokeLinecap="round"
        />
      </g>

      <defs>
        {filterElements}

        <linearGradient
          id={paint0Id}
          x1="91.07"
          y1="44.92"
          x2="99.96"
          y2="146.534"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={paint0Stop0Color} stopOpacity={theme.paint0Stop0Opacity} />
          <stop offset="1" stopColor={paint0Stop1Color} stopOpacity={theme.paint0Stop1Opacity} />
        </linearGradient>
        <linearGradient
          id={paint1Id}
          x1="91.07"
          y1="44.92"
          x2="99.96"
          y2="146.534"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={paint1Stop0Color} stopOpacity={paint1Stop0Opacity} />
          <stop offset="1" stopColor={paint1Stop1Color} stopOpacity={paint1Stop1Opacity} />
        </linearGradient>
        <linearGradient
          id={paint2Id}
          x1="99.96"
          y1="44.922"
          x2="91.07"
          y2="146.534"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={paint2Stop0Color} stopOpacity={theme.paint2Stop0Opacity} />
          <stop offset="1" stopColor={paint2Stop1Color} stopOpacity={theme.paint2Stop1Opacity} />
        </linearGradient>
        <linearGradient
          id={paint3Id}
          x1="99.96"
          y1="44.922"
          x2="91.07"
          y2="146.534"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={paint1Stop0Color} stopOpacity={paint1Stop0Opacity} />
          <stop offset="1" stopColor={paint1Stop1Color} stopOpacity={paint1Stop1Opacity} />
        </linearGradient>

        <clipPath id={clip0Id}>
          <path
            d="M54.43 48.97C54.82 44.57 58.7 41.31 63.1 41.7L136.82 48.15C141.22 48.53 144.47 52.41 144.09 56.81L136.59 142.49C136.21 146.89 132.33 150.14 127.93 149.76L54.21 143.31C49.81 142.92 46.55 139.04 46.94 134.64L54.43 48.97Z"
            fill={clipFill}
          />
        </clipPath>
        <clipPath id={clip1Id}>
          <rect
            width="16"
            height="16"
            fill={clipFill}
            transform="translate(62.4 49.67) rotate(5)"
          />
        </clipPath>
      </defs>
    </svg>
  );
};

export const EmptyState = (props: EmptyStateProps) => {
  return <EmptyStateBase {...props} isDarkTheme />;
};

export const EmptyStateLight = (props: EmptyStateProps) => {
  return <EmptyStateBase {...props} isDarkTheme={false} />;
};

export const EmptyStateIcon = ({ width = 200, height = 200, className }: EmptyStateProps) => {
  const resolvedTheme = useResolvedTheme();

  return resolvedTheme === "dark" ? (
    <EmptyState width={width} height={height} className={className} />
  ) : (
    <EmptyStateLight width={width} height={height} className={className} />
  );
};

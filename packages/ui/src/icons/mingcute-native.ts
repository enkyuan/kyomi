export type MingcuteNativePath = {
  readonly d: string;
  readonly fillRule?: "evenodd" | "nonzero";
};

export type MingcuteNativeIcon = {
  readonly viewBox: "0 0 24 24";
  readonly paths: readonly MingcuteNativePath[];
};

export const Rss2LineNativeIcon = {
  viewBox: "0 0 24 24",
  paths: [
    {
      d: "M5.5 17a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3m0-14C14.06 3 21 9.94 21 18.5q0 .268-.009.534a1 1 0 0 1-1.999-.068Q19 18.734 19 18.5C19 11.044 12.956 5 5.5 5q-.234 0-.466.008a1 1 0 0 1-.068-1.999Q5.231 3 5.5 3m0 7a8.5 8.5 0 0 1 8.482 9.066 1 1 0 0 1-1.996-.132 6.5 6.5 0 0 0-6.92-6.92 1 1 0 1 1-.132-1.995q.28-.02.566-.019",
    },
  ],
} as const satisfies MingcuteNativeIcon;

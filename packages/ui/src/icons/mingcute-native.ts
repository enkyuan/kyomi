/**
 * Renderer-neutral Mingcute geometry for current native consumers.
 *
 * Source: @mingcute/react@1.4.1 (Apache-2.0). Keep these as data so React
 * Native renderers do not pull the DOM-focused Mingcute component package.
 */
export type MingcuteNativePath = {
  readonly d: string;
  readonly fillRule?: "evenodd" | "nonzero";
};

export type MingcuteNativeIcon = {
  readonly viewBox: "0 0 24 24";
  readonly paths: readonly MingcuteNativePath[];
};

const viewBox = "0 0 24 24" as const;

export const Rss2LineNativeIcon: MingcuteNativeIcon = {
  viewBox,
  paths: [
    {
      d: "M5.5 17a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3m0-14C14.06 3 21 9.94 21 18.5q0 .268-.009.534a1 1 0 0 1-1.999-.068Q19 18.734 19 18.5C19 11.044 12.956 5 5.5 5q-.234 0-.466.008a1 1 0 0 1-.068-1.999Q5.231 3 5.5 3m0 7a8.5 8.5 0 0 1 8.482 9.066 1 1 0 0 1-1.996-.132 6.5 6.5 0 0 0-6.92-6.92 1 1 0 1 1-.132-1.995q.28-.02.566-.019",
    },
  ],
};

export const NewsLineNativeIcon: MingcuteNativeIcon = {
  viewBox,
  paths: [
    {
      d: "M16 3a2 2 0 0 1 1.995 1.85L18 5v5h1.5a1.5 1.5 0 0 1 1.493 1.356L21 11.5V19a3 3 0 0 1-2.824 2.995L18 22H5a2 2 0 0 1-1.995-1.85L3 20V5a2 2 0 0 1 1.85-1.995L5 3zm3 9h-1v8a1 1 0 0 0 1-1zm-3-7H5v15h11zm-5 8a1 1 0 0 1 .117 1.993L11 15H8a1 1 0 0 1-.117-1.993L8 13zm2-5a1 1 0 1 1 0 2H8a1 1 0 0 1 0-2z",
    },
  ],
};

export const FileImportLineNativeIcon: MingcuteNativeIcon = {
  viewBox,
  paths: [
    {
      d: "M13.586 2a2 2 0 0 1 1.284.467l.13.119L19.414 7a2 2 0 0 1 .578 1.238l.008.176V20a2 2 0 0 1-1.85 1.995L18 22h-6v-2h6V10h-4.5a1.5 1.5 0 0 1-1.493-1.356L12 8.5V4H6v8H4V4a2 2 0 0 1 1.85-1.995L6 2zM7.707 14.465l2.829 2.828a1 1 0 0 1 0 1.414l-2.829 2.828a1 1 0 1 1-1.414-1.414L7.414 19H3a1 1 0 1 1 0-2h4.414l-1.121-1.121a1 1 0 1 1 1.414-1.415ZM14 4.414V8h3.586z",
      fillRule: "evenodd",
    },
  ],
};

export const Folder2LineNativeIcon: MingcuteNativeIcon = {
  viewBox,
  paths: [
    {
      d: "M9.52 3a2 2 0 0 1 1.442.614l.12.137L12.48 5.5H20a2 2 0 0 1 1.995 1.85L22 7.5V19a2 2 0 0 1-1.85 1.995L20 21H4a2 2 0 0 1-1.995-1.85L2 19V5a2 2 0 0 1 1.85-1.995L4 3zM20 11H4v8h16zM9.52 5H4v4h16V7.5h-7.52a2 2 0 0 1-1.442-.614l-.12-.137z",
    },
  ],
};

export const BookmarkLineNativeIcon: MingcuteNativeIcon = {
  viewBox,
  paths: [
    {
      d: "M4 5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v16.028c0 1.22-1.38 1.93-2.372 1.221L12 18.229l-5.628 4.02c-.993.71-2.372 0-2.372-1.22zm3-1a1 1 0 0 0-1 1v15.057l5.128-3.663a1.5 1.5 0 0 1 1.744 0L18 20.057V5a1 1 0 0 0-1-1z",
    },
  ],
};

export const BookmarkFillNativeIcon: MingcuteNativeIcon = {
  viewBox,
  paths: [
    {
      d: "M4 5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v16.028c0 1.22-1.38 1.93-2.372 1.221L12 18.229l-5.628 4.02c-.993.71-2.372 0-2.372-1.22z",
    },
  ],
};

export const ShareForwardLineNativeIcon: MingcuteNativeIcon = {
  viewBox,
  paths: [
    {
      d: "M10.114 4.491c.076-.795.906-1.45 1.743-.972 1.74 1.019 3.382 2.18 4.97 3.421 1.96 1.548 3.533 3.007 4.647 4.172.483.507.438 1.308-.024 1.792a42 42 0 0 1-3.495 3.228c-1.938 1.587-3.945 3.125-6.13 4.358-.741.418-1.544-.06-1.687-.801l-.017-.113-.227-3.574c-1.816.038-3.574.662-4.98 1.823l-.265.222-.128.104-.247.192q-.06.045-.12.088l-.23.16a5 5 0 0 1-.218.135l-.206.111C2.534 19.314 2 18.892 2 17c0-4.404 3.245-8.323 7.632-8.917l.259-.031zm1.909 1.474-.192 3.472a.5.5 0 0 1-.447.47l-1.361.142c-3.065.366-5.497 2.762-5.948 5.894a9.95 9.95 0 0 1 5.135-1.912l.397-.023 1.704-.036a.5.5 0 0 1 .51.472l.197 3.596c1.603-1.021 3.131-2.196 4.664-3.45a44 44 0 0 0 2.857-2.595l-.258-.256-.556-.533a48 48 0 0 0-3.134-2.693 46 46 0 0 0-3.568-2.548",
    },
  ],
};

export const More1LineNativeIcon: MingcuteNativeIcon = {
  viewBox,
  paths: [
    {
      d: "M6 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3m6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3m6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3",
    },
  ],
};

export const ArrowLeftLineNativeIcon: MingcuteNativeIcon = {
  viewBox,
  paths: [
    {
      d: "M3.636 11.293a1 1 0 0 0 0 1.414l5.657 5.657a1 1 0 0 0 1.414-1.414L6.757 13H20a1 1 0 1 0 0-2H6.757l3.95-3.95a1 1 0 0 0-1.414-1.414z",
    },
  ],
};

export const ExternalLinkLineNativeIcon: MingcuteNativeIcon = {
  viewBox,
  paths: [
    {
      d: "M11 6a1 1 0 1 1 0 2H5v11h11v-6a1 1 0 1 1 2 0v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm9-3a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V6.414l-8.293 8.293a1 1 0 0 1-1.414-1.414L17.586 5H15a1 1 0 1 1 0-2Z",
    },
  ],
};

export const SearchLineNativeIcon: MingcuteNativeIcon = {
  viewBox,
  paths: [
    {
      d: "M10.5 2a8.5 8.5 0 1 0 5.262 15.176l3.652 3.652a1 1 0 0 0 1.414-1.414l-3.652-3.652A8.5 8.5 0 0 0 10.5 2M4 10.5a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0",
      fillRule: "evenodd",
    },
  ],
};

export const ListSearchLineNativeIcon: MingcuteNativeIcon = {
  viewBox,
  paths: [
    {
      d: "M4 4a1 1 0 0 0 0 2h16a1 1 0 1 0 0-2zm-1 8a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1m0 7a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1m7-5a5 5 0 1 1 9.172 2.757l1.535 1.536a1 1 0 0 1-1.414 1.414l-1.536-1.535A5 5 0 0 1 10 14m5-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
    },
  ],
};

export const CloseCircleLineNativeIcon: MingcuteNativeIcon = {
  viewBox,
  paths: [
    {
      d: "M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16M9.879 8.464 12 10.586l2.121-2.122a1 1 0 1 1 1.415 1.415l-2.122 2.12 2.122 2.122a1 1 0 0 1-1.415 1.415L12 13.414l-2.121 2.122a1 1 0 0 1-1.415-1.415L10.586 12 8.465 9.879a1 1 0 0 1 1.414-1.415",
    },
  ],
};

export const Filter2LineNativeIcon: MingcuteNativeIcon = {
  viewBox,
  paths: [
    {
      d: "M14 17a1 1 0 0 1 .117 1.993L14 19h-4a1 1 0 0 1-.117-1.993L10 17zm3-6a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2zm3-6a1 1 0 1 1 0 2H4a1 1 0 0 1 0-2z",
    },
  ],
};

export const Filter2FillNativeIcon: MingcuteNativeIcon = {
  viewBox,
  paths: [
    {
      d: "M14 16.5a1.5 1.5 0 0 1 .144 2.993L14 19.5h-4a1.5 1.5 0 0 1-.144-2.993L10 16.5zm3-6a1.5 1.5 0 0 1 0 3H7a1.5 1.5 0 0 1 0-3zm3-6a1.5 1.5 0 0 1 0 3H4a1.5 1.5 0 1 1 0-3z",
    },
  ],
};

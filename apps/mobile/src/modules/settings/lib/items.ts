import type { MingcuteNativeIcon } from "@kyomi/ui/icons/mingcute-native";
import {
  Bill2FillNativeIcon,
  DocumentFillNativeIcon,
  FileImportFillNativeIcon,
  HeadAiFillNativeIcon,
  Message3FillNativeIcon,
  SwitchFillNativeIcon,
  TimeDurationFillNativeIcon,
} from "@kyomi/ui/icons/mingcute-native";

type SettingsItem = {
  readonly id: string;
  readonly label: string;
  readonly icon: MingcuteNativeIcon;
};

export const SETTINGS_GROUPS: readonly (readonly SettingsItem[])[] = [
  [
    {
      id: "recently-visited",
      label: "Recently Visited",
      icon: TimeDurationFillNativeIcon,
    },
    {
      id: "import-opml",
      label: "Import OPML",
      icon: FileImportFillNativeIcon,
    },
    {
      id: "billing",
      label: "Billing",
      icon: Bill2FillNativeIcon,
    },
  ],
  [
    {
      id: "personalization",
      label: "Personalization",
      icon: HeadAiFillNativeIcon,
    },
    {
      id: "reader",
      label: "Reader",
      icon: DocumentFillNativeIcon,
    },
    {
      id: "advanced",
      label: "Advanced",
      icon: SwitchFillNativeIcon,
    },
    {
      id: "feedback",
      label: "Feedback",
      icon: Message3FillNativeIcon,
    },
  ],
];

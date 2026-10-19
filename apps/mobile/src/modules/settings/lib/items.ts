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
  readonly route: string;
};

export const SETTINGS_GROUPS: readonly (readonly SettingsItem[])[] = [
  [
    {
      id: "recently-visited",
      label: "Recently Visited",
      icon: TimeDurationFillNativeIcon,
      route: "/(protected)/settings/recents",
    },
    {
      id: "import-opml",
      label: "Import OPML",
      icon: FileImportFillNativeIcon,
      route: "/(protected)/settings/import-opml",
    },
    {
      id: "billing",
      label: "Billing",
      icon: Bill2FillNativeIcon,
      route: "/(protected)/settings/billing",
    },
  ],
  [
    {
      id: "personalization",
      label: "Personalization",
      icon: HeadAiFillNativeIcon,
      route: "/(protected)/settings/personalization",
    },
    {
      id: "reader",
      label: "Reader",
      icon: DocumentFillNativeIcon,
      route: "/(protected)/settings/reader",
    },
    {
      id: "advanced",
      label: "Advanced",
      icon: SwitchFillNativeIcon,
      route: "/(protected)/settings/advanced",
    },
    {
      id: "feedback",
      label: "Feedback",
      icon: Message3FillNativeIcon,
      route: "/(protected)/settings/feedback",
    },
  ],
];

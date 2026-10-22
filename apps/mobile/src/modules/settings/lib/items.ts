import {
  BlankPagePortraitNativeIcon,
  BrainNativeIcon,
  ClockNativeIcon,
  FileArrowLeftInNativeIcon,
  MessageCircleNativeIcon,
  ReceiptBillNativeIcon,
  ToggleNativeIcon,
  type BlodeNativeIcon,
} from "@kyomi/ui/icons/blode-native";

type SettingsItem = {
  readonly id: string;
  readonly label: string;
  /** Navigation rows carry a line icon only where it aids recognition; text-only groups omit it. */
  readonly icon?: BlodeNativeIcon;
  readonly route: string;
};

export const SETTINGS_GROUPS: readonly (readonly SettingsItem[])[] = [
  [
    {
      id: "recently-visited",
      label: "Recently Visited",
      icon: ClockNativeIcon,
      route: "/(protected)/settings/recents",
    },
    {
      id: "import-opml",
      label: "Import OPML",
      icon: FileArrowLeftInNativeIcon,
      route: "/(protected)/settings/import-opml",
    },
    {
      id: "billing",
      label: "Billing",
      icon: ReceiptBillNativeIcon,
      route: "/(protected)/settings/billing",
    },
  ],
  [
    {
      id: "personalization",
      label: "Personalization",
      icon: BrainNativeIcon,
      route: "/(protected)/settings/personalization",
    },
    {
      id: "reader",
      label: "Reader",
      icon: BlankPagePortraitNativeIcon,
      route: "/(protected)/settings/reader",
    },
    {
      id: "advanced",
      label: "Advanced",
      icon: ToggleNativeIcon,
      route: "/(protected)/settings/advanced",
    },
  ],
  [
    {
      id: "feedback",
      label: "Feedback",
      icon: MessageCircleNativeIcon,
      route: "/(protected)/settings/feedback",
    },
  ],
];

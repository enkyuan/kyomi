import {
  BrainFilledNativeIcon,
  ClockFilledNativeIcon,
  FileArrowLeftInFilledNativeIcon,
  FileTextFilledNativeIcon,
  MessageCircleFilledNativeIcon,
  ReceiptBillFilledNativeIcon,
  ToggleFilledNativeIcon,
  type BlodeNativeIcon,
} from "@kyomi/ui/icons/blode-native";

type SettingsItem = {
  readonly id: string;
  readonly label: string;
  readonly icon: BlodeNativeIcon;
  readonly route: string;
};

export const SETTINGS_GROUPS: readonly (readonly SettingsItem[])[] = [
  [
    {
      id: "recently-visited",
      label: "Recently Visited",
      icon: ClockFilledNativeIcon,
      route: "/(protected)/settings/recents",
    },
    {
      id: "import-opml",
      label: "Import OPML",
      icon: FileArrowLeftInFilledNativeIcon,
      route: "/(protected)/settings/import-opml",
    },
    {
      id: "billing",
      label: "Billing",
      icon: ReceiptBillFilledNativeIcon,
      route: "/(protected)/settings/billing",
    },
  ],
  [
    {
      id: "personalization",
      label: "Personalization",
      icon: BrainFilledNativeIcon,
      route: "/(protected)/settings/personalization",
    },
    {
      id: "reader",
      label: "Reader",
      icon: FileTextFilledNativeIcon,
      route: "/(protected)/settings/reader",
    },
    {
      id: "advanced",
      label: "Advanced",
      icon: ToggleFilledNativeIcon,
      route: "/(protected)/settings/advanced",
    },
    {
      id: "feedback",
      label: "Feedback",
      icon: MessageCircleFilledNativeIcon,
      route: "/(protected)/settings/feedback",
    },
  ],
];

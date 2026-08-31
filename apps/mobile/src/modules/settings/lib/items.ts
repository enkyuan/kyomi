export const SETTINGS_GROUPS = [
  [
    {
      id: "account",
      label: "Account",
      symbol: { android: "person", ios: "person", web: "person" },
    },
    {
      id: "appearance",
      label: "Appearance",
      symbol: { android: "palette", ios: "paintbrush", web: "palette" },
    },
    {
      id: "personalization",
      label: "Personalization",
      symbol: { android: "wand_shine", ios: "wand.and.stars", web: "wand_shine" },
    },
    {
      id: "advanced",
      label: "Advanced",
      symbol: { android: "tune", ios: "slider.horizontal.3", web: "tune" },
    },
  ],
  [
    {
      id: "billing",
      label: "Billing",
      symbol: { android: "credit_card", ios: "creditcard", web: "credit_card" },
    },
    {
      id: "feedback",
      label: "Feedback",
      symbol: { android: "feedback", ios: "bubble.left", web: "feedback" },
    },
    {
      id: "import-opml",
      label: "Import OPML",
      symbol: { android: "upload_file", ios: "arrow.down.doc", web: "upload_file" },
    },
    {
      id: "recently-viewed",
      label: "Recently Viewed",
      symbol: { android: "history", ios: "clock.arrow.circlepath", web: "history" },
    },
  ],
] as const;

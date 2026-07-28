import { Stack } from "expo-router";

import { InboxScreen } from "@/modules/inbox/screen";

export default function InboxRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "Inbox",
          headerLargeTitle: true,
          headerLargeTitleShadowVisible: false,
        }}
      />
      <InboxScreen />
    </>
  );
}

import { Stack } from "expo-router";
import { useState } from "react";
import { RecentsScreen } from "@modules/recents/screen";
import { RECENT_RANGES, type RecentRange } from "@modules/recents/lib/range";
import { SettingsDetailToolbar } from "@modules/settings/components/detail-toolbar";
import { useTheme } from "@ui/liquid-glass/hooks/use-theme";

export default function SettingsRecentsRoute() {
  const { colors } = useTheme();
  const [range, setRange] = useState<RecentRange>("all");

  return (
    <>
      <RecentsScreen range={range} showHeader={false} title="Recents" />
      <SettingsDetailToolbar title="Recents" />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          accessibilityLabel="Filter by date"
          icon="line.3.horizontal.decrease"
          tintColor={colors.foreground}
        >
          {RECENT_RANGES.map((option) => (
            <Stack.Toolbar.MenuAction
              isOn={range === option.id}
              key={option.id}
              onPress={() => setRange(option.id)}
            >
              {option.label}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
    </>
  );
}

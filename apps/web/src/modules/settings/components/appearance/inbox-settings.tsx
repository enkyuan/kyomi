"use client";

import { Group, GroupSeparator } from "@kyomi/ui/group";
import { Tabs, TabsList, TabsTab } from "@kyomi/ui/tabs";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@kyomi/ui/select";
import { Switch } from "@kyomi/ui/switch";
import type { InboxPreferences } from "@modules/inbox/hooks/use-inbox-data";
import { SettingHeading, SettingSubHeading } from "./shared";

const INBOX_TEXT_SCALE_OPTIONS = [
  { label: "sm", value: "sm", fontSizePx: 14 },
  { label: "md", value: "md", fontSizePx: 16 },
  { label: "lg", value: "lg", fontSizePx: 18 },
  { label: "xl", value: "xl", fontSizePx: 20 },
] as const;

type InboxTextScaleValue = (typeof INBOX_TEXT_SCALE_OPTIONS)[number]["value"];
type InboxTextScaleOption = (typeof INBOX_TEXT_SCALE_OPTIONS)[number];

function getInboxTextScaleValue(fontSizePx: number): InboxTextScaleValue {
  let closestOption: InboxTextScaleOption = INBOX_TEXT_SCALE_OPTIONS[0];
  let closestDistance = Math.abs(fontSizePx - closestOption.fontSizePx);

  for (const option of INBOX_TEXT_SCALE_OPTIONS.slice(1)) {
    const distance = Math.abs(fontSizePx - option.fontSizePx);
    if (distance < closestDistance) {
      closestOption = option;
      closestDistance = distance;
    }
  }

  return closestOption.value;
}

function getInboxTextScaleFontSize(value: string): number | null {
  return INBOX_TEXT_SCALE_OPTIONS.find((option) => option.value === value)?.fontSizePx ?? null;
}

type InboxAppearanceSettingsProps = {
  preferences: InboxPreferences;
  setPreferences: (next: Partial<InboxPreferences>) => void;
};

export function InboxAppearanceSettings({
  preferences,
  setPreferences,
}: InboxAppearanceSettingsProps) {
  return (
    <section className="space-y-3">
      <SettingHeading
        description="Adjust inbox density and what metadata stays visible while scanning."
        title="Inbox"
      />
      <div className="space-y-3 py-1">
        <SettingSubHeading
          description="Compact trims row spacing for denser scanning. Comfortable preserves the current roomy card layout."
          title="Density"
        />
        <Select
          items={[
            { label: "Comfortable", value: "comfortable" },
            { label: "Compact", value: "compact" },
          ]}
          value={preferences.inboxDensity}
          onValueChange={(value) => {
            if (value === "comfortable" || value === "compact") {
              setPreferences({ inboxDensity: value });
            }
          }}
        >
          <SelectTrigger className="w-fit min-w-44" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            <SelectItem value="comfortable">Comfortable</SelectItem>
            <SelectItem value="compact">Compact</SelectItem>
          </SelectPopup>
        </Select>
      </div>

      <div className="space-y-3 py-1">
        <SettingSubHeading
          description="Scale inbox item text while preserving title, summary, and metadata hierarchy."
          title="Text size"
        />
        <Tabs
          value={getInboxTextScaleValue(preferences.inboxFontSizePx)}
          onValueChange={(value) => {
            const fontSizePx = getInboxTextScaleFontSize(value as string);
            if (fontSizePx !== null) {
              setPreferences({ inboxFontSizePx: fontSizePx });
            }
          }}
        >
          <TabsList aria-label="Inbox text scale" variant="pill">
            {INBOX_TEXT_SCALE_OPTIONS.map((option) => (
              <TabsTab key={option.value} className="px-3" value={option.value}>
                {option.label}
              </TabsTab>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-3 py-1">
        <SettingSubHeading
          description="Relative recency is the default for inbox timestamps; switch to absolute when you need exact dates."
          title="Timestamp"
        />
        <Group aria-label="Timestamp format">
          <Select
            items={[
              { label: "Relative", value: "relative" },
              { label: "Absolute", value: "absolute" },
            ]}
            value={preferences.inboxTimestampDisplay}
            onValueChange={(value) => {
              if (value === "absolute" || value === "relative") {
                setPreferences({ inboxTimestampDisplay: value });
              }
            }}
          >
            <SelectTrigger className="w-fit min-w-0" size="sm">
              <SelectValue className="flex-none" />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="relative">Relative</SelectItem>
              <SelectItem value="absolute">Absolute</SelectItem>
            </SelectPopup>
          </Select>
          <GroupSeparator />
          <Select
            items={[
              { label: "12-hour", value: "12h" },
              { label: "24-hour", value: "24h" },
            ]}
            value={preferences.inboxTimestampHourCycle}
            onValueChange={(value) => {
              if (value === "12h" || value === "24h") {
                setPreferences({ inboxTimestampHourCycle: value });
              }
            }}
          >
            <SelectTrigger className="w-fit min-w-0" size="sm">
              <SelectValue className="flex-none" />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="12h">12-hour</SelectItem>
              <SelectItem value="24h">24-hour</SelectItem>
            </SelectPopup>
          </Select>
        </Group>
      </div>

      <div className="space-y-3 py-1">
        <label htmlFor="inbox-show-favicons" className="flex items-center justify-between gap-4">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">Show favicons</span>
            <span className="block text-xs text-muted-foreground">
              Show the feed/site icon in each inbox item row.
            </span>
          </span>
          <Switch
            id="inbox-show-favicons"
            checked={preferences.inboxShowFavicons}
            onCheckedChange={(checked) => setPreferences({ inboxShowFavicons: checked })}
          />
        </label>
      </div>
    </section>
  );
}

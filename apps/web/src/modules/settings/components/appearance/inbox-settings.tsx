"use client";

import { FontSizeLine } from "@mingcute/react";
import { Group, GroupSeparator } from "@vols.rss/ui/group";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@vols.rss/ui/select";
import { SliderComfortable } from "@vols.rss/ui/slider";
import { Switch } from "@vols.rss/ui/switch";
import type { InboxPreferences } from "@modules/inbox/hooks/use-inbox-data";
import { SettingHeading, SettingSubHeading } from "./shared";

type InboxAppearanceSettingsProps = {
  limits: { minFontSizePx: number; maxFontSizePx: number };
  preferences: InboxPreferences;
  setPreferences: (next: Partial<InboxPreferences>) => void;
};

export function InboxAppearanceSettings({
  limits,
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
          description="Choose which inbox view opens first when you land on the inbox."
          title="Default view"
        />
        <Select
          items={[
            { label: "Today", value: "today" },
            { label: "All unread", value: "unread" },
            { label: "Read later", value: "saved" },
          ]}
          value={preferences.inboxDefaultView}
          onValueChange={(value) => {
            if (value === "today" || value === "unread" || value === "saved") {
              setPreferences({ inboxDefaultView: value });
            }
          }}
        >
          <SelectTrigger className="w-fit min-w-48" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="unread">All unread</SelectItem>
            <SelectItem value="saved">Read later</SelectItem>
          </SelectPopup>
        </Select>
      </div>

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
        <SliderComfortable
          formatValue={(value) => `${value}px`}
          label={<FontSizeLine size={20} />}
          max={limits.maxFontSizePx}
          min={limits.minFontSizePx}
          step={1}
          variant="scrubber"
          value={preferences.inboxFontSizePx}
          onChange={(value) => {
            setPreferences({ inboxFontSizePx: value });
          }}
        />
      </div>

      <div className="space-y-3 py-1">
        <SettingSubHeading
          description="Control whether opening an article immediately clears it from unread, waits briefly, or leaves that action manual."
          title="Mark as read"
        />
        <Select
          items={[
            { label: "On open", value: "on-open" },
            { label: "After delay", value: "after-delay" },
            { label: "Manual only", value: "manual" },
          ]}
          value={preferences.inboxMarkReadBehavior}
          onValueChange={(value) => {
            if (value === "on-open" || value === "after-delay" || value === "manual") {
              setPreferences({ inboxMarkReadBehavior: value });
            }
          }}
        >
          <SelectTrigger className="w-fit min-w-48" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            <SelectItem value="on-open">On open</SelectItem>
            <SelectItem value="after-delay">After delay</SelectItem>
            <SelectItem value="manual">Manual only</SelectItem>
          </SelectPopup>
        </Select>
      </div>

      <div className="space-y-3 py-1">
        <SettingSubHeading
          description="Choose whether inbox timestamps prioritize precise calendar dates or relative recency."
          title="Timestamp"
        />
        <Group aria-label="Timestamp format">
          <Select
            items={[
              { label: "Absolute", value: "absolute" },
              { label: "Relative", value: "relative" },
            ]}
            value={preferences.inboxTimestampDisplay}
            onValueChange={(value) => {
              if (value === "absolute" || value === "relative") {
                setPreferences({ inboxTimestampDisplay: value });
              }
            }}
          >
            <SelectTrigger className="min-w-44" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="absolute">Absolute</SelectItem>
              <SelectItem value="relative">Relative</SelectItem>
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
            <SelectTrigger className="min-w-40" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="12h">12-hour</SelectItem>
              <SelectItem value="24h">24-hour</SelectItem>
            </SelectPopup>
          </Select>
        </Group>
      </div>

      <div className="space-y-3 py-1">
        <label htmlFor="inbox-show-recents" className="flex items-center justify-between gap-4">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">Show recents tab</span>
            <span className="block text-xs text-muted-foreground">
              Keep a dedicated tab ready for recently read items when that view is available.
            </span>
          </span>
          <Switch
            id="inbox-show-recents"
            checked={preferences.inboxShowRecents}
            onCheckedChange={(checked) => setPreferences({ inboxShowRecents: checked })}
          />
        </label>
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

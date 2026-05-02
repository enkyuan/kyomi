"use client";

import {
  Calendar3Fill,
  DocumentFill,
  FontSizeLine,
  InboxFill,
  Layout5Fill,
  MailOpenFill,
  NewsFill,
  StarFill,
  TimeFill,
} from "@mingcute/react";
import { Button } from "@components/ui/button";
import { Group, GroupSeparator } from "@components/ui/group";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@components/ui/select";
import { SidebarMenuButton, SidebarMenuItem } from "@components/ui/sidebar";
import { SliderComfortable } from "@components/ui/slider";
import { Switch } from "@components/ui/switch";
import { useInboxPreferences } from "@lib/inbox-preferences";

export const inboxSection = {
  description: "Control inbox navigation, list density, and article-opening behavior.",
  icon: InboxFill,
  name: "Inbox",
} as const;

type InboxPageNavProps = {
  isActive: boolean;
  onSelect: () => void;
};

export function InboxPageNav({ isActive, onSelect }: InboxPageNavProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} onClick={onSelect}>
        <InboxFill />
        <span>{inboxSection.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function SettingHeading({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: typeof InboxFill;
  title: string;
}) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Icon className="size-4 text-muted-foreground" />
        <span>{title}</span>
      </p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

const INBOX_VIEW_ICON_BY_VALUE = {
  inbox: InboxFill,
  saved: StarFill,
  today: Calendar3Fill,
  unread: NewsFill,
} as const;

function AnimatedInboxViewIcon({ value }: { value: keyof typeof INBOX_VIEW_ICON_BY_VALUE }) {
  return (
    <span className="relative size-4 shrink-0 overflow-hidden">
      {Object.entries(INBOX_VIEW_ICON_BY_VALUE).map(([iconValue, Icon]) => {
        const isActive = iconValue === value;

        return (
          <Icon
            key={iconValue}
            className={[
              "absolute inset-0 size-4 text-muted-foreground transition-[opacity,filter,transform] duration-200 ease-out",
              isActive
                ? "scale-100 opacity-100 blur-0"
                : "scale-92 opacity-0 blur-[6px] pointer-events-none",
            ].join(" ")}
          />
        );
      })}
    </span>
  );
}

export function InboxPagePanel() {
  const { limits, preferences, resetPreferences, setPreferences } = useInboxPreferences();

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Preferences</h3>
        <Button size="sm" variant="outline" onClick={resetPreferences}>
          Reset defaults
        </Button>
      </div>

      <div className="space-y-3 py-1">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <AnimatedInboxViewIcon value={preferences.inboxDefaultView} />
            <span>Default view</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Choose which inbox view opens first when you land on the inbox.
          </p>
        </div>
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
        <SettingHeading
          description="Compact trims row spacing for denser scanning. Comfortable preserves the current roomy card layout."
          icon={Layout5Fill}
          title="Inbox density"
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
        <SettingHeading
          description="Scale inbox item text while preserving title, summary, and metadata hierarchy."
          icon={FontSizeLine}
          title="Inbox text size"
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
        <SettingHeading
          description="Split keeps the current list and detail layout. Reader opens a dedicated reading view, while Original goes straight to the source."
          icon={DocumentFill}
          title="Article view"
        />
        <Select
          items={[
            { label: "Split view", value: "split" },
            { label: "Reader focus", value: "reader" },
            { label: "Original link", value: "original" },
          ]}
          value={preferences.articleOpenBehavior}
          onValueChange={(value) => {
            if (value === "split" || value === "reader" || value === "original") {
              setPreferences({ articleOpenBehavior: value });
            }
          }}
        >
          <SelectTrigger className="w-fit min-w-52" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            <SelectItem value="split">Split view</SelectItem>
            <SelectItem value="reader">Reader focus</SelectItem>
            <SelectItem value="original">Original link</SelectItem>
          </SelectPopup>
        </Select>
      </div>

      <div className="space-y-3 py-1">
        <SettingHeading
          description="Control whether opening an article immediately clears it from unread, waits briefly, or leaves that action manual."
          icon={MailOpenFill}
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
        <SettingHeading
          description="Choose whether inbox timestamps prioritize precise calendar dates or relative recency."
          icon={TimeFill}
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
        <label className="flex items-center justify-between gap-4">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">Show recents tab</span>
            <span className="block text-xs text-muted-foreground">
              Keep a dedicated tab ready for recently read items when that view is available.
            </span>
          </span>
          <Switch
            checked={preferences.inboxShowRecents}
            onCheckedChange={(checked) => setPreferences({ inboxShowRecents: checked })}
          />
        </label>
      </div>

      <div className="space-y-3 py-1">
        <label className="flex items-center justify-between gap-4">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">Show favicons</span>
            <span className="block text-xs text-muted-foreground">
              Show the feed/site icon in each inbox item row.
            </span>
          </span>
          <Switch
            checked={preferences.inboxShowFavicons}
            onCheckedChange={(checked) => setPreferences({ inboxShowFavicons: checked })}
          />
        </label>
      </div>
    </section>
  );
}

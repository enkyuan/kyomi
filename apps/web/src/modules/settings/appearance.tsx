"use client";

import { BrushFill, FontSizeLine } from "@mingcute/react";
import { Button } from "@components/ui/button";
import { Group, GroupSeparator } from "@components/ui/group";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@components/ui/select";
import { SidebarMenuButton, SidebarMenuItem } from "@components/ui/sidebar";
import { SliderComfortable } from "@components/ui/slider";
import { Switch } from "@components/ui/switch";
import { useInboxPreferences } from "@lib/inbox-preferences";
import { useReaderPreferences } from "@lib/reader-preferences";
import { ThemeSwitcher } from "./theme-switcher";

export const appearanceSection = {
  description: "Adjust theme, inbox presentation, and reader display behavior.",
  icon: BrushFill,
  name: "Appearance",
} as const;

type AppearancePageNavProps = {
  isActive: boolean;
  onSelect: () => void;
};

const APPEARANCE_SUBSECTION_SPACING_CLASS = "space-y-8";

function SettingHeading({ description, title }: { description: string; title: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export function AppearancePageNav({ isActive, onSelect }: AppearancePageNavProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} onClick={onSelect}>
        <BrushFill />
        <span>{appearanceSection.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppearancePagePanel() {
  const {
    limits: inboxLimits,
    preferences: inboxPreferences,
    resetPreferences: resetInboxPreferences,
    setPreferences: setInboxPreferences,
  } = useInboxPreferences();
  const {
    limits: readerLimits,
    preferences: readerPreferences,
    resetPreferences: resetReaderPreferences,
    setPreferences: setReaderPreferences,
  } = useReaderPreferences();

  if (!inboxPreferences || !readerPreferences) {
    return null;
  }

  const handleResetAll = () => {
    resetInboxPreferences();
    resetReaderPreferences();
  };

  return (
    <div className={APPEARANCE_SUBSECTION_SPACING_CLASS}>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Appearance</h3>
          <Button size="sm" variant="outline" onClick={handleResetAll}>
            Reset defaults
          </Button>
        </div>
        <ThemeSwitcher />
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Inbox</h3>
          <p className="text-xs text-muted-foreground">
            Adjust how the inbox opens, how dense it feels, and what metadata stays visible while
            scanning.
          </p>
        </div>
        <div className="space-y-3 py-1">
          <SettingHeading
            description="Choose which inbox view opens first when you land on the inbox."
            title="Default view"
          />
          <Select
            items={[
              { label: "All items", value: "inbox" },
              { label: "Today", value: "today" },
              { label: "All unread", value: "unread" },
              { label: "Read later", value: "saved" },
            ]}
            value={inboxPreferences.inboxDefaultView}
            onValueChange={(value) => {
              if (
                value === "inbox" ||
                value === "today" ||
                value === "unread" ||
                value === "saved"
              ) {
                setInboxPreferences({ inboxDefaultView: value });
              }
            }}
          >
            <SelectTrigger className="w-fit min-w-48" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="inbox">All items</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="unread">All unread</SelectItem>
              <SelectItem value="saved">Read later</SelectItem>
            </SelectPopup>
          </Select>
        </div>

        <div className="space-y-3 py-1">
          <SettingHeading
            description="Compact trims row spacing for denser scanning. Comfortable preserves the current roomy card layout."
            title="Inbox density"
          />
          <Select
            items={[
              { label: "Comfortable", value: "comfortable" },
              { label: "Compact", value: "compact" },
            ]}
            value={inboxPreferences.inboxDensity}
            onValueChange={(value) => {
              if (value === "comfortable" || value === "compact") {
                setInboxPreferences({ inboxDensity: value });
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
            title="Inbox text size"
          />
          <SliderComfortable
            formatValue={(value) => `${value}px`}
            label={<FontSizeLine size={20} />}
            max={inboxLimits.maxFontSizePx}
            min={inboxLimits.minFontSizePx}
            step={1}
            variant="scrubber"
            value={inboxPreferences.inboxFontSizePx}
            onChange={(value) => {
              setInboxPreferences({ inboxFontSizePx: value });
            }}
          />
        </div>

        <div className="space-y-3 py-1">
          <SettingHeading
            description="Split keeps the current list and detail layout. Reader opens a dedicated reading view."
            title="Article view"
          />
          <Select
            items={[
              { label: "Split view", value: "split" },
              { label: "Reader focus", value: "reader" },
            ]}
            value={inboxPreferences.articleOpenBehavior}
            onValueChange={(value) => {
              if (value === "split" || value === "reader") {
                setInboxPreferences({ articleOpenBehavior: value });
              }
            }}
          >
            <SelectTrigger className="w-fit min-w-52" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="split">Split view</SelectItem>
              <SelectItem value="reader">Reader focus</SelectItem>
            </SelectPopup>
          </Select>
        </div>

        <div className="space-y-3 py-1">
          <SettingHeading
            description="Control whether opening an article immediately clears it from unread, waits briefly, or leaves that action manual."
            title="Mark as read"
          />
          <Select
            items={[
              { label: "On open", value: "on-open" },
              { label: "After delay", value: "after-delay" },
              { label: "Manual only", value: "manual" },
            ]}
            value={inboxPreferences.inboxMarkReadBehavior}
            onValueChange={(value) => {
              if (value === "on-open" || value === "after-delay" || value === "manual") {
                setInboxPreferences({ inboxMarkReadBehavior: value });
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
            title="Timestamp"
          />
          <Group aria-label="Timestamp format">
            <Select
              items={[
                { label: "Absolute", value: "absolute" },
                { label: "Relative", value: "relative" },
              ]}
              value={inboxPreferences.inboxTimestampDisplay}
              onValueChange={(value) => {
                if (value === "absolute" || value === "relative") {
                  setInboxPreferences({ inboxTimestampDisplay: value });
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
              value={inboxPreferences.inboxTimestampHourCycle}
              onValueChange={(value) => {
                if (value === "12h" || value === "24h") {
                  setInboxPreferences({ inboxTimestampHourCycle: value });
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
              checked={inboxPreferences.inboxShowRecents}
              onCheckedChange={(checked) => setInboxPreferences({ inboxShowRecents: checked })}
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
              checked={inboxPreferences.inboxShowFavicons}
              onCheckedChange={(checked) => setInboxPreferences({ inboxShowFavicons: checked })}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Reader</h3>
          <p className="text-xs text-muted-foreground">
            Control the default reader mode, typography, width, and how article content behaves when
            you interact with it.
          </p>
        </div>
        <div className="space-y-3 py-1">
          <SettingHeading
            description="Choose how articles open by default. Smart follows the server recommendation."
            title="Default reader mode"
          />
          <Select
            items={[
              { label: "Smart (recommended)", value: "smart" },
              { label: "Original", value: "original" },
              { label: "Extracted", value: "extracted" },
            ]}
            value={readerPreferences.defaultMode}
            onValueChange={(value) => {
              if (value === "smart" || value === "original" || value === "extracted") {
                setReaderPreferences({ defaultMode: value });
              }
            }}
          >
            <SelectTrigger className="w-fit min-w-56" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="smart">Smart (recommended)</SelectItem>
              <SelectItem value="original">Original</SelectItem>
              <SelectItem value="extracted">Extracted</SelectItem>
            </SelectPopup>
          </Select>
        </div>

        <div className="space-y-3 py-1">
          <SettingHeading description="Adjust reader text size for comfort." title="Font size" />
          <SliderComfortable
            formatValue={(value) => `${value}px`}
            label={<FontSizeLine size={20} />}
            max={readerLimits.maxFontSizePx}
            min={readerLimits.minFontSizePx}
            step={1}
            variant="scrubber"
            value={readerPreferences.fontSizePx}
            onChange={(value) => {
              setReaderPreferences({ fontSizePx: value });
            }}
          />
        </div>

        <div className="space-y-3 py-1">
          <SettingHeading
            description="Narrow keeps shorter line lengths, wide fits more text on large screens."
            title="Content width"
          />
          <Select
            items={[
              { label: "Narrow", value: "narrow" },
              { label: "Wide", value: "wide" },
            ]}
            value={readerPreferences.contentWidth}
            onValueChange={(value) => {
              if (value === "narrow" || value === "wide") {
                setReaderPreferences({ contentWidth: value });
              }
            }}
          >
            <SelectTrigger className="w-fit min-w-44" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="narrow">Narrow</SelectItem>
              <SelectItem value="wide">Wide</SelectItem>
            </SelectPopup>
          </Select>
        </div>

        <div className="space-y-3 py-1">
          <label className="flex items-center justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                Open links in new tab
              </span>
              <span className="block text-xs text-muted-foreground">
                Applies to article links and source links in reader view.
              </span>
            </span>
            <Switch
              checked={readerPreferences.openLinksInNewTab}
              onCheckedChange={(checked) => setReaderPreferences({ openLinksInNewTab: checked })}
            />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                Link previews on hover
              </span>
              <span className="block text-xs text-muted-foreground">
                Show preview cards when hovering article links in the reader.
              </span>
            </span>
            <Switch
              checked={readerPreferences.showLinkPreviews}
              onCheckedChange={(checked) => setReaderPreferences({ showLinkPreviews: checked })}
            />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">Show images</span>
              <span className="block text-xs text-muted-foreground">
                Hide inline images for a cleaner, text-first reading view.
              </span>
            </span>
            <Switch
              checked={readerPreferences.showImages}
              onCheckedChange={(checked) => setReaderPreferences({ showImages: checked })}
            />
          </label>
        </div>
      </section>
    </div>
  );
}

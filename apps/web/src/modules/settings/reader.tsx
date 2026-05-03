"use client";
import { FontSizeLine, NewsFill } from "@mingcute/react";
import { Button } from "@components/ui/button";
import { SidebarMenuButton, SidebarMenuItem } from "@components/ui/sidebar";
import { SliderComfortable } from "@components/ui/slider";
import { Switch } from "@components/ui/switch";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@components/ui/select";
import { useReaderPreferences } from "@lib/reader-preferences";

export const readerSection = {
  description: "Adjust how the reader organizes, previews, and opens content.",
  icon: NewsFill,
  name: "Reader",
} as const;

type ReaderPageNavProps = {
  isActive: boolean;
  onSelect: () => void;
};

export function ReaderPageNav({ isActive, onSelect }: ReaderPageNavProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} onClick={onSelect}>
        <NewsFill />
        <span>{readerSection.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function ReaderPagePanel() {
  const { limits, preferences, resetPreferences, setPreferences } = useReaderPreferences();

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
          <p className="text-sm font-medium text-foreground">Default reader mode</p>
          <p className="text-xs text-muted-foreground">
            Choose how articles open by default. Smart follows the server recommendation.
          </p>
        </div>
        <Select
          items={[
            { label: "Smart (recommended)", value: "smart" },
            { label: "Original", value: "original" },
            { label: "Extracted", value: "extracted" },
          ]}
          value={preferences.defaultMode}
          onValueChange={(value) => {
            if (value === "smart" || value === "original" || value === "extracted") {
              setPreferences({ defaultMode: value });
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
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Font size</p>
          <p className="text-xs text-muted-foreground">Adjust reader text size for comfort.</p>
        </div>
        <SliderComfortable
          formatValue={(value) => `${value}px`}
          label={<FontSizeLine size={20} />}
          max={limits.maxFontSizePx}
          min={limits.minFontSizePx}
          step={1}
          variant="scrubber"
          value={preferences.fontSizePx}
          onChange={(value) => {
            setPreferences({ fontSizePx: value });
          }}
        />
      </div>

      <div className="space-y-3 py-1">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Content width</p>
          <p className="text-xs text-muted-foreground">
            Narrow keeps shorter line lengths, wide fits more text on large screens.
          </p>
        </div>
        <Select
          items={[
            { label: "Narrow", value: "narrow" },
            { label: "Medium", value: "medium" },
            { label: "Wide", value: "wide" },
          ]}
          value={preferences.contentWidth}
          onValueChange={(value) => {
            if (value === "narrow" || value === "medium" || value === "wide") {
              setPreferences({ contentWidth: value });
            }
          }}
        >
          <SelectTrigger className="w-fit min-w-44" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            <SelectItem value="narrow">Narrow</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="wide">Wide</SelectItem>
          </SelectPopup>
        </Select>
      </div>

      <div className="space-y-3 py-1">
        <label className="flex items-center justify-between gap-4">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">Open links in new tab</span>
            <span className="block text-xs text-muted-foreground">
              Applies to article links and source links in reader view.
            </span>
          </span>
          <Switch
            checked={preferences.openLinksInNewTab}
            onCheckedChange={(checked) => setPreferences({ openLinksInNewTab: checked })}
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
            checked={preferences.showLinkPreviews}
            onCheckedChange={(checked) => setPreferences({ showLinkPreviews: checked })}
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
            checked={preferences.showImages}
            onCheckedChange={(checked) => setPreferences({ showImages: checked })}
          />
        </label>
      </div>
    </section>
  );
}

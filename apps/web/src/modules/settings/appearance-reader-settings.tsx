"use client";

import { FontSizeLine } from "@mingcute/react";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@components/ui/select";
import { SliderComfortable } from "@components/ui/slider";
import { Switch } from "@components/ui/switch";
import type { ReaderPreferences } from "@lib/reader-preferences";
import { SettingHeading } from "./appearance-shared";

type ReaderAppearanceSettingsProps = {
  limits: { minFontSizePx: number; maxFontSizePx: number };
  preferences: ReaderPreferences;
  setPreferences: (next: Partial<ReaderPreferences>) => void;
};

export function ReaderAppearanceSettings({
  limits,
  preferences,
  setPreferences,
}: ReaderAppearanceSettingsProps) {
  return (
    <section className="space-y-3">
      <SettingHeading
        description="Control the default reader mode, typography, width, and how article content behaves when you interact with it."
        title="Reader"
      />
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
        <SettingHeading description="Adjust reader text size for comfort." title="Font size" />
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
        <SettingHeading
          description="Narrow keeps shorter line lengths, wide fits more text on large screens."
          title="Content width"
        />
        <Select
          items={[
            { label: "Narrow", value: "narrow" },
            { label: "Wide", value: "wide" },
          ]}
          value={preferences.contentWidth}
          onValueChange={(value) => {
            if (value === "narrow" || value === "wide") {
              setPreferences({ contentWidth: value });
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

"use client";

import { PreviewRadioGroup, type PreviewRadioItem } from "@kyomi/ui/components/preview-radio-group";
import { SliderComfortable } from "@kyomi/ui/components/slider";
import {
  AnimatePresence,
  LazyMotion,
  controlSwapMotion,
  domAnimation,
  m,
  useReducedMotion,
} from "@kyomi/ui/lib/motion";
import { Tabs, TabsList, TabsTab } from "@kyomi/ui/components/tabs";
import { formatInboxTimestamp } from "@modules/articles/lib/format-timestamp";
import { useMemo } from "react";
import { Switch } from "@kyomi/ui/components/switch";
import type { InboxPreferences } from "@modules/inbox/hooks/use-preferences";
import { SettingHeading, SettingSubHeading } from "./headings";

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

function getInboxTextScaleIndex(fontSizePx: number): number {
  const value = getInboxTextScaleValue(fontSizePx);
  return INBOX_TEXT_SCALE_OPTIONS.findIndex((option) => option.value === value);
}

/** Rows of an inbox list at each density: fewer, roomier rows against more, tighter ones. */
function DensityPreview({ rows }: { rows: number }) {
  const pitch = 62 / rows;
  const small = rows > 3;
  return (
    <svg
      aria-hidden
      className="size-full text-foreground"
      fill="none"
      viewBox="0 0 88 70"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect className="fill-muted" height="70" width="88" />
      {Array.from({ length: rows }, (_, index) => {
        const y = 4 + index * pitch;
        const mid = y + pitch / 2 - 1;
        return (
          <g key={y} className="fill-current">
            <circle cx="14" cy={mid} opacity="0.22" r={small ? 3.5 : 6} />
            <rect
              height={small ? 3 : 4}
              opacity="0.22"
              rx="1.5"
              width="46"
              x="26"
              y={small ? mid - 1.5 : mid - 5}
            />
            {small ? null : <rect height="4" opacity="0.14" rx="2" width="30" x="26" y={mid + 2} />}
          </g>
        );
      })}
    </svg>
  );
}

const DENSITY_OPTIONS: readonly PreviewRadioItem<InboxPreferences["inboxDensity"]>[] = [
  { label: "Comfortable", preview: <DensityPreview rows={3} />, value: "comfortable" },
  { label: "Compact", preview: <DensityPreview rows={6} />, value: "compact" },
];

type TimestampDisplay = InboxPreferences["inboxTimestampDisplay"];

/** What the picker shows: both relative styles live under one "Relative" option. */
const TIMESTAMP_FORMATS = [
  { label: "Relative", value: "relative" },
  { label: "Date & time", value: "absolute" },
  { label: "Date", value: "date" },
  { label: "ISO", value: "iso" },
] as const;

function getTimestampFormat(
  display: TimestampDisplay,
): (typeof TIMESTAMP_FORMATS)[number]["value"] {
  return display === "relative-long" ? "relative" : display;
}

/** Only the formats that show a time are affected by the 12 or 24-hour clock. */
function showsClock(display: InboxPreferences["inboxTimestampDisplay"]) {
  return display === "absolute" || display === "iso";
}

/**
 * The options that belong to the chosen format (a style for Relative, a clock for the formats with
 * a time) and an example line. They blur in when the format changes, and not at all on first paint.
 */
function TimestampOptions({
  preferences,
  setPreferences,
}: {
  preferences: InboxPreferences;
  setPreferences: (next: Partial<InboxPreferences>) => void;
}) {
  const reducedMotion = useReducedMotion();
  const display = preferences.inboxTimestampDisplay;
  const hourCycle = preferences.inboxTimestampHourCycle;
  // Two hours back, so every format has something to show.
  const sample = useMemo(() => new Date(Date.now() - 2 * 3_600_000).toISOString(), []);
  const motionProps = {
    ...controlSwapMotion(reducedMotion),
    transition: { bounce: 0, duration: 0.25, type: "spring" as const },
  };
  const group = getTimestampFormat(display);

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence initial={false} mode="popLayout">
        {group === "relative" ? (
          <m.div key="style" {...motionProps}>
            <Tabs
              value={display}
              onValueChange={(value) => {
                if (value === "relative" || value === "relative-long") {
                  setPreferences({ inboxTimestampDisplay: value });
                }
              }}
            >
              <TabsList aria-label="Relative style" variant="pill">
                <TabsTab className="px-3" value="relative">
                  Compact
                </TabsTab>
                <TabsTab className="px-3" value="relative-long">
                  Expanded
                </TabsTab>
              </TabsList>
            </Tabs>
          </m.div>
        ) : showsClock(display) ? (
          <m.div key="clock" {...motionProps}>
            <Tabs
              value={hourCycle}
              onValueChange={(value) => {
                if (value === "12h" || value === "24h") {
                  setPreferences({ inboxTimestampHourCycle: value });
                }
              }}
            >
              <TabsList aria-label="Clock" variant="pill">
                <TabsTab className="px-3" value="12h">
                  12-hour
                </TabsTab>
                <TabsTab className="px-3" value="24h">
                  24-hour
                </TabsTab>
              </TabsList>
            </Tabs>
          </m.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence initial={false} mode="popLayout">
        <m.p
          key={`${display}-${showsClock(display) ? hourCycle : ""}`}
          className="text-muted-foreground text-xs tabular-nums"
          {...motionProps}
        >
          Example: {formatInboxTimestamp(sample, display, hourCycle)}
        </m.p>
      </AnimatePresence>
    </LazyMotion>
  );
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
        <PreviewRadioGroup
          aria-label="Inbox density"
          items={DENSITY_OPTIONS}
          value={preferences.inboxDensity}
          onValueChange={(value) => setPreferences({ inboxDensity: value })}
        />
      </div>

      <div className="space-y-3 py-1">
        <SettingSubHeading
          description="Scale inbox item text while preserving title, summary, and metadata hierarchy."
          title="Text size"
        />
        <SliderComfortable
          aria-label="Inbox text size"
          className="max-w-xs"
          formatValue={(index) => INBOX_TEXT_SCALE_OPTIONS[index]?.label ?? ""}
          max={INBOX_TEXT_SCALE_OPTIONS.length - 1}
          min={0}
          step={1}
          value={getInboxTextScaleIndex(preferences.inboxFontSizePx)}
          onChange={(index) => {
            const option = INBOX_TEXT_SCALE_OPTIONS[index];
            if (option) {
              setPreferences({ inboxFontSizePx: option.fontSizePx });
            }
          }}
        />
      </div>

      <div className="space-y-3 py-1">
        <SettingSubHeading
          description="Relative recency is the default for inbox timestamps; switch to absolute when you need exact dates."
          title="Timestamp"
        />
        <Tabs
          value={getTimestampFormat(preferences.inboxTimestampDisplay)}
          onValueChange={(value) => {
            const format = TIMESTAMP_FORMATS.find((option) => option.value === value);
            // Picking Relative again keeps the style already chosen.
            if (format && format.value !== getTimestampFormat(preferences.inboxTimestampDisplay)) {
              setPreferences({ inboxTimestampDisplay: format.value });
            }
          }}
        >
          <TabsList aria-label="Timestamp format" variant="pill">
            {TIMESTAMP_FORMATS.map((option) => (
              <TabsTab key={option.value} className="px-3" value={option.value}>
                {option.label}
              </TabsTab>
            ))}
          </TabsList>
        </Tabs>
        <TimestampOptions preferences={preferences} setPreferences={setPreferences} />
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

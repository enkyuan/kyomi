import { router } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, useColorScheme, View } from "react-native";
import { EmptyStateIcon } from "@/components/icons/empty-state";
import { EMPTY_STATES } from "@modules/inbox/components/empty-states";
import { SettingsDetailToolbar } from "@modules/settings/components/detail-toolbar";
import { FONT_STYLES } from "@/theme/fonts";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { useOpmlImport } from "./hooks/use-import";
import type { OpmlImportSummary } from "./lib/api";

const MAX_FAILURES_SHOWN = 5;

export function ImportOpmlScreen() {
  const theme = getMobileSurfaceTheme(useColorScheme());
  const { errorMessage, importState, phase, reset, start } = useOpmlImport();
  const summary = importState?.summary;

  return (
    <>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          gap: 20,
          justifyContent: "center",
          paddingBottom: 96,
          paddingHorizontal: 32,
        }}
        style={{ backgroundColor: theme.background }}
      >
        {phase === "idle" ? (
          <>
            <View className="items-center">
              <EmptyStateIcon icon={EMPTY_STATES["import-opml"].icon} size={176} />
            </View>
            {/* React Native has no `text-wrap: balance`, so the two lines are broken by hand. */}
            <Text
              style={[
                FONT_STYLES.bodyMediumMedium,
                { color: theme.mutedForeground, textAlign: "center" },
              ]}
            >
              {EMPTY_STATES["import-opml"].description}
            </Text>
            <PrimaryButton label="Choose File" onPress={start} />
          </>
        ) : null}

        {phase === "starting" ? (
          <Centered theme={theme} title="Uploading" detail="Sending your file…" busy />
        ) : null}

        {phase === "running" ? <Running summary={summary} theme={theme} /> : null}

        {phase === "done" && summary ? (
          <Finished onAnother={reset} summary={summary} theme={theme} title="Import complete" />
        ) : null}

        {phase === "stopped" ? (
          <Centered
            detail={importState?.message ?? "The import stopped before it finished."}
            theme={theme}
            title="Import stopped"
          >
            <PrimaryButton label="Try Again" onPress={reset} />
          </Centered>
        ) : null}

        {phase === "error" ? (
          <Centered
            detail={errorMessage ?? "Something went wrong. Try again."}
            theme={theme}
            title="Couldn’t import"
          >
            <PrimaryButton label="Try Again" onPress={reset} />
          </Centered>
        ) : null}
      </ScrollView>
      <SettingsDetailToolbar title="Import OPML" />
    </>
  );
}

type Theme = ReturnType<typeof getMobileSurfaceTheme>;

function Centered({
  busy,
  children,
  detail,
  theme,
  title,
}: {
  readonly busy?: boolean;
  readonly children?: React.ReactNode;
  readonly detail: string;
  readonly theme: Theme;
  readonly title: string;
}) {
  return (
    <View className="items-center gap-3">
      {busy ? <ActivityIndicator color={theme.mutedForeground} /> : null}
      <Text style={[FONT_STYLES.sectionTitle, { color: theme.foreground, textAlign: "center" }]}>
        {title}
      </Text>
      <Text style={[FONT_STYLES.bodyMedium, { color: theme.mutedForeground, textAlign: "center" }]}>
        {detail}
      </Text>
      {children ? <View className="mt-2">{children}</View> : null}
    </View>
  );
}

function Running({
  summary,
  theme,
}: {
  readonly summary: OpmlImportSummary | undefined;
  readonly theme: Theme;
}) {
  const total = summary?.totalUrls ?? 0;
  const done = summary?.completed ?? 0;
  const fraction = total > 0 ? Math.min(1, done / total) : 0;

  return (
    <View className="gap-4">
      <Text style={[FONT_STYLES.sectionTitle, { color: theme.foreground, textAlign: "center" }]}>
        Importing feeds
      </Text>
      <View
        accessibilityLabel="Import progress"
        accessibilityValue={{ max: 100, min: 0, now: Math.round(fraction * 100) }}
        style={{ backgroundColor: theme.input, borderRadius: 99, height: 6, overflow: "hidden" }}
      >
        <View
          style={{
            backgroundColor: theme.foreground,
            borderRadius: 99,
            height: "100%",
            width: `${fraction * 100}%`,
          }}
        />
      </View>
      <Text style={[FONT_STYLES.bodyMedium, { color: theme.mutedForeground, textAlign: "center" }]}>
        {total > 0 ? `${done} of ${total} feeds` : "Reading your file…"}
      </Text>
    </View>
  );
}

function Finished({
  onAnother,
  summary,
  theme,
  title,
}: {
  readonly onAnother: () => void;
  readonly summary: OpmlImportSummary;
  readonly theme: Theme;
  readonly title: string;
}) {
  const rows: readonly (readonly [string, number])[] = [
    ["Added", summary.subscribed],
    ["Already followed", summary.alreadySubscribed],
    ["Couldn’t be added", summary.failed],
  ];

  return (
    <View className="gap-5">
      <Text style={[FONT_STYLES.sectionTitle, { color: theme.foreground, textAlign: "center" }]}>
        {title}
      </Text>
      <View className="gap-2">
        {rows.map(([label, count]) => (
          <View className="flex-row justify-between" key={label}>
            <Text style={[FONT_STYLES.bodyMedium, { color: theme.mutedForeground }]}>{label}</Text>
            <Text
              style={[
                FONT_STYLES.bodyMedium,
                { color: theme.foreground, fontVariant: ["tabular-nums"] },
              ]}
            >
              {count}
            </Text>
          </View>
        ))}
      </View>
      {summary.failures.length > 0 ? (
        <View className="gap-2">
          {summary.failures.slice(0, MAX_FAILURES_SHOWN).map((failure) => (
            <View key={failure.url}>
              <Text numberOfLines={1} style={[FONT_STYLES.bodySmall, { color: theme.foreground }]}>
                {failure.url}
              </Text>
              <Text
                numberOfLines={2}
                style={[FONT_STYLES.bodyMediumMedium, { color: theme.mutedForeground }]}
              >
                {failure.message}
              </Text>
            </View>
          ))}
          {summary.failures.length > MAX_FAILURES_SHOWN ? (
            <Text style={[FONT_STYLES.bodyMediumMedium, { color: theme.mutedForeground }]}>
              {`and ${summary.failures.length - MAX_FAILURES_SHOWN} more`}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View className="items-center gap-3">
        <PrimaryButton label="Done" onPress={() => router.back()} />
        <Pressable
          accessibilityRole="button"
          className="min-h-11 justify-center"
          onPress={onAnother}
        >
          <Text style={[FONT_STYLES.button, { color: theme.mutedForeground }]}>Import Another</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
}: {
  readonly label: string;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="min-h-12 items-center justify-center self-center rounded-full bg-primary px-8 active:opacity-70"
      onPress={onPress}
    >
      <Text className="text-primary-foreground" style={FONT_STYLES.button}>
        {label}
      </Text>
    </Pressable>
  );
}

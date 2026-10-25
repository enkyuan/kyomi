import { Pressable, Text, View } from "react-native";
import { useState } from "react";
import type { ReaderBlock, ReaderImage } from "../../core/document";
import { useReaderNative } from "./context";
import { Inlines } from "./inline";
import { Caption, imageAspectRatio } from "./media";
import { hostnameOf, inlinesToText } from "./text";

const PROVIDER_NAMES: Record<string, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  x: "X",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
  threads: "Threads",
  instagram: "Instagram",
  tiktok: "TikTok",
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  "apple-podcasts": "Apple Podcasts",
  "github-gist": "GitHub Gist",
  codepen: "CodePen",
  codesandbox: "CodeSandbox",
  loom: "Loom",
  figma: "Figma",
};

export function providerName(provider: string): string {
  return PROVIDER_NAMES[provider] ?? provider;
}

function CardFrame({
  children,
  label,
  url,
}: {
  readonly children: React.ReactNode;
  readonly label: string;
  readonly url: string;
}) {
  const { host, theme } = useReaderNative();
  return (
    <Pressable
      accessibilityHint="Opens in the browser"
      accessibilityLabel={label}
      accessibilityRole="link"
      onLongPress={() => host.shareUrl?.(url)}
      onPress={() => host.openUrl(url)}
      style={{
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border,
        borderRadius: 12,
        borderWidth: 1,
        overflow: "hidden",
      }}
    >
      {children}
    </Pressable>
  );
}

function Thumb({ image }: { readonly image: ReaderImage }) {
  const { host } = useReaderNative();
  if (!host.renderImage) return null;
  return host.renderImage({
    image,
    aspectRatio: imageAspectRatio(image, 16 / 9),
    accessibilityLabel: image.alt || undefined,
    radius: 0,
    fit: "cover",
    onPress: undefined,
  });
}

export function LinkCardBlock({
  block,
}: {
  readonly block: Extract<ReaderBlock, { type: "linkCard" }>;
}) {
  const { theme } = useReaderNative();
  const site = block.siteName ?? hostnameOf(block.url);
  const title = block.title ?? block.url;
  const text = { fontFamily: theme.fonts.body, maxFontSizeMultiplier: theme.maxFontSizeMultiplier };
  return (
    <CardFrame label={`${title}, ${site}`} url={block.url}>
      {block.image ? <Thumb image={block.image} /> : null}
      <View style={{ gap: 4, padding: 12 }}>
        <Text
          {...text}
          numberOfLines={2}
          style={{
            color: theme.colors.foreground,
            fontFamily: theme.fonts.strong,
            fontSize: theme.fontSize * 0.95,
          }}
        >
          {title}
        </Text>
        {block.description ? (
          <Text
            {...text}
            numberOfLines={3}
            style={{ color: theme.colors.muted, fontSize: theme.fontSize * 0.85 }}
          >
            {block.description}
          </Text>
        ) : null}
        <Text
          {...text}
          numberOfLines={1}
          style={{ color: theme.colors.muted, fontSize: theme.fontSize * 0.78 }}
        >
          {site}
        </Text>
      </View>
    </CardFrame>
  );
}

type EmbedBlock = Extract<ReaderBlock, { type: "embed" }>;

function SnapshotCard({
  block,
  snapshot,
}: {
  readonly block: EmbedBlock;
  readonly snapshot: NonNullable<EmbedBlock["snapshot"]>;
}) {
  const { theme } = useReaderNative();
  const provider = providerName(block.provider);
  const author = snapshot.author;
  const label = [author?.name, inlinesToText(snapshot.text) || snapshot.title, provider]
    .filter(Boolean)
    .join(", ");
  const text = { fontFamily: theme.fonts.body, maxFontSizeMultiplier: theme.maxFontSizeMultiplier };
  return (
    <CardFrame label={label} url={block.url}>
      <View style={{ gap: 8, padding: 12 }}>
        {author ? (
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text
                {...text}
                numberOfLines={1}
                style={{
                  color: theme.colors.foreground,
                  fontFamily: theme.fonts.strong,
                  fontSize: theme.fontSize * 0.9,
                }}
              >
                {author.name}
              </Text>
              {author.handle ? (
                <Text
                  {...text}
                  numberOfLines={1}
                  style={{ color: theme.colors.muted, fontSize: theme.fontSize * 0.78 }}
                >
                  {author.handle}
                </Text>
              ) : null}
            </View>
            <Text {...text} style={{ color: theme.colors.muted, fontSize: theme.fontSize * 0.78 }}>
              {provider}
            </Text>
          </View>
        ) : null}
        {snapshot.title ? (
          <Text
            {...text}
            style={{
              color: theme.colors.foreground,
              fontFamily: theme.fonts.strong,
              fontSize: theme.fontSize * 0.95,
            }}
          >
            {snapshot.title}
          </Text>
        ) : null}
        {snapshot.text?.length ? (
          <Text
            {...text}
            style={{
              color: theme.colors.foreground,
              fontSize: theme.fontSize * 0.95,
              lineHeight: theme.fontSize * 0.95 * 1.5,
            }}
          >
            <Inlines inlines={snapshot.text} />
          </Text>
        ) : null}
      </View>
      {(snapshot.media ?? (snapshot.thumbnail ? [snapshot.thumbnail] : []))
        .slice(0, 1)
        .map((image) => (
          <Thumb image={image} key={image.src} />
        ))}
    </CardFrame>
  );
}

/** Tap-to-load: the player box is reserved up front but no WebView mounts until the reader asks. */
function PlayerIsland({
  block,
  frameUrl,
}: {
  readonly block: EmbedBlock;
  readonly frameUrl: string;
}) {
  const { host, theme } = useReaderNative();
  const [active, setActive] = useState(false);
  const aspectRatio = block.aspectRatio ?? 16 / 9;
  const provider = providerName(block.provider);
  const island = active
    ? host.renderIsland?.({ kind: "embed", frameUrl, aspectRatio, title: provider })
    : null;

  if (island)
    return (
      <View style={{ aspectRatio, borderRadius: 10, overflow: "hidden", width: "100%" }}>
        {island}
      </View>
    );
  return (
    <Pressable
      accessibilityLabel={`Load ${provider} player`}
      accessibilityRole="button"
      onPress={() => setActive(true)}
      style={{
        alignItems: "center",
        aspectRatio,
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border,
        borderRadius: 10,
        borderWidth: 1,
        justifyContent: "center",
        width: "100%",
      }}
    >
      <Text
        maxFontSizeMultiplier={theme.maxFontSizeMultiplier}
        style={{
          color: theme.colors.foreground,
          fontFamily: theme.fonts.strong,
          fontSize: theme.fontSize * 0.95,
        }}
      >
        ▶ {provider}
      </Text>
    </Pressable>
  );
}

export function EmbedBlockView({ block }: { readonly block: EmbedBlock }) {
  const { host } = useReaderNative();
  let body;
  if (block.snapshot) body = <SnapshotCard block={block} snapshot={block.snapshot} />;
  else if (block.frameUrl && host.renderIsland)
    body = <PlayerIsland block={block} frameUrl={block.frameUrl} />;
  else
    body = (
      <LinkCardBlock
        block={{
          type: "linkCard",
          url: block.url,
          title: `${providerName(block.provider)} · ${hostnameOf(block.url)}`,
        }}
      />
    );
  return (
    <View>
      {body}
      <Caption caption={block.caption} />
    </View>
  );
}

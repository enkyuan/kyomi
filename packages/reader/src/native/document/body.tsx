import { FlatList, View, type FlatListProps, type ViewToken } from "react-native";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactElement,
} from "react";
import type { ReaderDocument } from "../../core/document";
import { BlockView, ProseRun } from "./blocks";
import { ReaderNativeProvider, type ReaderNativeHost } from "./context";
import { planDocument, type ReaderSegment } from "./plan";
import type { ReaderNativeTheme } from "./theme";
import { useReadingTracking, type NativeReadingSample } from "./tracking";

export type NativeDocumentBodyHandle = {
  scrollToAnchor: (anchor: string) => boolean;
};

export type NativeDocumentBodyProps = {
  document: ReaderDocument;
  theme: ReaderNativeTheme;
  host: ReaderNativeHost;
  /** Horizontal padding applied to every row; `full` media bleeds into it. */
  inset: number;
  header?: ReactElement | null | undefined;
  /** Space reserved under the last block (tab bar, home indicator). */
  bottomInset?: number | undefined;
  /** Restore with the segment index saved from `onScrollIndexChange`; stable across font changes. */
  initialIndex?: number | undefined;
  onScrollIndexChange?: ((index: number) => void) | undefined;
  /**
   * Restore to this reading progress (0..1, the reading line within the article body) once laid
   * out. Takes precedence over `initialIndex`, which is ignored when this is set.
   */
  initialProgress?: number | undefined;
  /** Reading progress samples, measured the way the DOM reader measures them. */
  onReadingProgress?: ((sample: NativeReadingSample) => void) | undefined;
  /** Fires once, after the first rows are laid out. */
  onFirstContentLayout?: (() => void) | undefined;
  listProps?: Partial<FlatListProps<ReaderSegment>> | undefined;
};

const VIEWABILITY = { itemVisiblePercentThreshold: 10 } as const;

/**
 * Block-group virtualization: each row is a paragraph run or a single block, so rows are large
 * enough to keep the row count small and small enough to unmount off-screen media.
 */
export const NativeDocumentBody = forwardRef<NativeDocumentBodyHandle, NativeDocumentBodyProps>(
  function NativeDocumentBody(props, ref) {
    const {
      document,
      theme,
      host,
      inset,
      header,
      bottomInset = 0,
      initialIndex,
      initialProgress,
      listProps,
    } = props;
    const { onScrollIndexChange, onFirstContentLayout, onReadingProgress } = props;
    const plan = useMemo(() => planDocument(document), [document]);
    const listRef = useRef<FlatList<ReaderSegment>>(null);
    const laidOut = useRef(false);
    const tracking = useReadingTracking({
      bottomInset,
      initialProgress,
      listRef,
      onReadingProgress,
    });

    const scrollToAnchor = useCallback(
      (anchor: string) => {
        const index = plan.anchorIndex[anchor];
        if (index === undefined) return false;
        listRef.current?.scrollToIndex({ animated: !theme.reduceMotion, index, viewPosition: 0 });
        return true;
      },
      [plan, theme.reduceMotion],
    );
    useImperativeHandle(ref, () => ({ scrollToAnchor }), [scrollToAnchor]);

    const value = useMemo(
      () => ({
        theme,
        host: { ...host, scrollToAnchor: host.scrollToAnchor ?? scrollToAnchor },
        footnotes: plan.footnotes,
      }),
      [host, plan.footnotes, scrollToAnchor, theme],
    );

    const onViewableItemsChanged = useCallback(
      ({ viewableItems }: { viewableItems: ViewToken[] }) => {
        const first = viewableItems.find((item) => item.index !== null)?.index;
        if (first !== null && first !== undefined) onScrollIndexChange?.(first);
      },
      [onScrollIndexChange],
    );

    const renderItem = useCallback(
      ({ item, index }: { item: ReaderSegment; index: number }) => (
        <View
          onLayout={
            index === 0 && onFirstContentLayout
              ? () => {
                  if (laidOut.current) return;
                  laidOut.current = true;
                  onFirstContentLayout();
                }
              : undefined
          }
          style={{ alignSelf: "center", marginBottom: theme.blockGap, width: theme.columnWidth }}
        >
          {item.kind === "prose" ? (
            <ProseRun blocks={item.blocks} />
          ) : (
            <BlockView block={item.block} />
          )}
        </View>
      ),
      [onFirstContentLayout, theme.blockGap, theme.columnWidth],
    );

    return (
      <ReaderNativeProvider value={value}>
        <FlatList
          ref={listRef}
          // The header's height is where the article body starts, for progress measures.
          ListHeaderComponent={<View onLayout={tracking.onHeaderLayout}>{header}</View>}
          contentContainerStyle={{ paddingBottom: bottomInset, paddingHorizontal: inset }}
          data={plan.segments}
          initialNumToRender={6}
          initialScrollIndex={
            initialProgress === undefined && initialIndex && initialIndex < plan.segments.length
              ? initialIndex
              : undefined
          }
          keyExtractor={(item) => item.key}
          maxToRenderPerBatch={4}
          onScrollToIndexFailed={({ averageItemLength, index }) => {
            // Rows past the measured window have no layout yet: jump near, then retry.
            listRef.current?.scrollToOffset({ animated: false, offset: averageItemLength * index });
            setTimeout(() => listRef.current?.scrollToIndex({ animated: false, index }), 50);
          }}
          onContentSizeChange={tracking.onContentSizeChange}
          onLayout={tracking.onLayout}
          onScroll={tracking.onScroll}
          onScrollBeginDrag={tracking.onScrollBeginDrag}
          onViewableItemsChanged={onViewableItemsChanged}
          renderItem={renderItem}
          scrollEventThrottle={16}
          viewabilityConfig={VIEWABILITY}
          windowSize={7}
          {...listProps}
        />
      </ReaderNativeProvider>
    );
  },
);

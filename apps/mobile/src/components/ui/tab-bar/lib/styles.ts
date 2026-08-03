import { StyleSheet } from "react-native";

const SEPARATE_WIDTH = 72;
const READER_SEPARATE_WIDTH = 72;
export const TAB_BAR_HEIGHT = 56;
export const TAB_BAR_BOTTOM_OFFSET = 30;
export const TAB_BAR_OCCLUSION_HEIGHT = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_OFFSET;
export const READER_TAB_BAR_HEIGHT = 56;
export const READER_TAB_BAR_OCCLUSION_HEIGHT = READER_TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_OFFSET;

export const styles = StyleSheet.create({
  row: {
    position: "absolute",
    bottom: TAB_BAR_BOTTOM_OFFSET,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  wrapper: {
    flex: 1,
    borderRadius: 32,
    overflow: "hidden",
  },
  separateWrapper: {
    width: SEPARATE_WIDTH,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    overflow: "hidden",
  },
  primarySurface: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderRadius: 32,
  },
  separateSurface: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderRadius: TAB_BAR_HEIGHT / 2,
  },
  bar: {
    flexDirection: "row",
    height: TAB_BAR_HEIGHT,
  },
  separateBar: {
    flex: 1,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 200,
    margin: 6,
    position: "relative",
  },
  tabPressed: {
    opacity: 0.7,
  },
  tabBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 200,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  readerRow: {
    position: "absolute",
    bottom: TAB_BAR_BOTTOM_OFFSET,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liquidHost: {
    position: "absolute",
    bottom: TAB_BAR_BOTTOM_OFFSET,
    left: 20,
    right: 20,
    height: TAB_BAR_HEIGHT,
  },
  liquidHostedContent: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  liquidPrimaryGroup: {
    flex: 1,
    flexDirection: "row",
    height: TAB_BAR_HEIGHT,
  },
  liquidSeparateGroup: {
    flex: 1,
  },
  readerWrapper: {
    flex: 1,
    minWidth: 0,
    height: READER_TAB_BAR_HEIGHT,
    borderRadius: READER_TAB_BAR_HEIGHT / 2,
    overflow: "hidden",
  },
  readerSurface: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderRadius: READER_TAB_BAR_HEIGHT / 2,
  },
  readerBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  readerAction: {
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    margin: 4,
  },
  readerActionPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  readerSearchField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  readerSearchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    color: "#f4f4f5",
    fontSize: 14,
  },
  readerSearchCloseAction: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
  },
  readerSeparateWrapper: {
    width: READER_SEPARATE_WIDTH,
    height: READER_TAB_BAR_HEIGHT,
    borderRadius: READER_TAB_BAR_HEIGHT / 2,
    overflow: "hidden",
  },
  readerSeparateSurface: {
    width: READER_SEPARATE_WIDTH,
    height: READER_TAB_BAR_HEIGHT,
    borderRadius: READER_TAB_BAR_HEIGHT / 2,
  },
  readerSeparateAction: {
    width: READER_SEPARATE_WIDTH,
    height: READER_TAB_BAR_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: READER_TAB_BAR_HEIGHT / 2,
  },
});

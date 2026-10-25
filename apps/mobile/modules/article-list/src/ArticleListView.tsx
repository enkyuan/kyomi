import { requireNativeView } from "expo";
import { forwardRef, type ComponentType, type RefAttributes } from "react";
import Animated from "react-native-reanimated";
import type { ArticleListHandle, ArticleListViewProps } from "./ArticleList.types";

const NativeArticleListView = requireNativeView<
  ArticleListViewProps & { refreshEnabled?: boolean }
>("ArticleList");

// Expo adds view functions to its ref at runtime; Reanimated forwards that same native ref.
const AnimatedArticleListView = Animated.createAnimatedComponent(
  NativeArticleListView,
) as ComponentType<
  ArticleListViewProps & { refreshEnabled: boolean } & RefAttributes<ArticleListHandle>
>;

/**
 * Animated so `onScroll` can take a Reanimated event handler: the native scroll event is then
 * handled on the UI thread, as a `ScrollView`'s is, instead of crossing to JS every frame.
 *
 * Reanimated forwards `ref` to the Expo view component, which carries the native view's functions,
 * so a ref exposes `ArticleListHandle`.
 */
export const ArticleListView = forwardRef<ArticleListHandle, ArticleListViewProps>(
  function ArticleListView(props, ref) {
    return (
      <AnimatedArticleListView {...props} refreshEnabled={Boolean(props.onRefresh)} ref={ref} />
    );
  },
);

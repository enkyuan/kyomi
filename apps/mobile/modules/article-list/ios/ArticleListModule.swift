import ExpoModulesCore

struct ListInsetsRecord: Record {
  @Field var top: Double = 0
  @Field var bottom: Double = 0
}

public class ArticleListModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ArticleList")

    View(ArticleListView.self) {
      Events("onEndReached", "onScroll", "onRowPress", "onRowPressIn", "onRowAction", "onRefresh", "onVisibleItemsChange")

      // Rows are not a prop: Fabric hands every prop to the view on every update, so a prop that
      // grows with the list would be converted again on each change to any other prop. JavaScript
      // sends row operations instead. ExpoModulesCore moves view functions to the main queue only
      // for SwiftUI views, so this one asks for it; the view is main-actor isolated, and the
      // function only queues the payload for the pipeline.
      AsyncFunction("applyOps") { (view: ArticleListView, payload: String) in
        MainActor.assumeIsolated { view.applyOps(payload) }
      }.runOnQueue(.main)

      AsyncFunction("scrollToItem") { (view: ArticleListView, id: String, animated: Bool, promise: Promise) in
        MainActor.assumeIsolated { promise.resolve(view.scrollToItem(id, animated: animated)) }
      }.runOnQueue(.main)

      AsyncFunction("scrollToOffset") { (view: ArticleListView, offset: Double, animated: Bool) in
        MainActor.assumeIsolated { view.setOffset(CGFloat(offset), animated: animated) }
      }.runOnQueue(.main)

      Prop("refreshing") { (view: ArticleListView, refreshing: Bool?) in
        view.setRefreshing(refreshing ?? false)
      }
      Prop("refreshEnabled") { (view: ArticleListView, enabled: Bool?) in
        view.setRefreshEnabled(enabled ?? false)
      }
      OnViewDidUpdateProps { (view: ArticleListView) in view.applyInsets() }

      Prop("listStyle") { (view: ArticleListView, style: ListStyleRecord) in
        view.setStyle(style)
      }

      Prop("contentInset") { (view: ArticleListView, inset: ListInsetsRecord?) in
        view.contentInset = inset
      }

      Prop("scrollIndicatorInset") { (view: ArticleListView, inset: ListInsetsRecord?) in
        view.indicatorInset = inset
      }

      Prop("adjustsInsetsAutomatically") { (view: ArticleListView, automatic: Bool?) in
        view.setAdjustsInsetsAutomatically(automatic ?? false)
      }

      Prop("endReachedDistance") { (view: ArticleListView, rows: Int?) in
        view.setEndReachedDistance(rows ?? 5)
      }

      Prop("scrollToTopToken") { (view: ArticleListView, token: Int?) in
        view.setScrollToTopToken(token ?? 0)
      }
    }
  }
}

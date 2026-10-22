import ExpoModulesCore

struct ListInsetsRecord: Record {
  @Field var top: Double = 0
  @Field var bottom: Double = 0
}

public class ArticleListModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ArticleList")

    View(ArticleListView.self) {
      Events("onEndReached", "onScroll", "onRowPress", "onRowPressIn", "onRowAction")

      Prop("rows") { (view: ArticleListView, rows: [ArticleRowRecord]) in
        view.setRows(rows.map(\.model))
      }

      Prop("listStyle") { (view: ArticleListView, style: ListStyleRecord) in
        view.setStyle(ArticleListStyle(style))
      }

      Prop("contentInset") { (view: ArticleListView, inset: ListInsetsRecord?) in
        view.contentInset = inset
        view.applyInsets()
      }

      Prop("scrollIndicatorInset") { (view: ArticleListView, inset: ListInsetsRecord?) in
        view.indicatorInset = inset
        view.applyInsets()
      }

      Prop("adjustsInsetsAutomatically") { (view: ArticleListView, automatic: Bool?) in
        view.setAdjustsInsetsAutomatically(automatic ?? false)
      }

      Prop("hasMore") { (view: ArticleListView, hasMore: Bool?) in
        view.setHasMore(hasMore ?? false)
      }

      Prop("endReachedThreshold") { (view: ArticleListView, threshold: Double?) in
        view.setEndReachedThreshold(threshold ?? 0.5)
      }

      Prop("scrollToTopToken") { (view: ArticleListView, token: Int?) in
        view.setScrollToTopToken(token ?? 0)
      }
    }
  }
}

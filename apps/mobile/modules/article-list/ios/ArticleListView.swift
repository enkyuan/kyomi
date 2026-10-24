import ExpoModulesCore
import SwiftUI
import UIKit

/// Layout chrome read by the collection view's section provider on the main thread.
final class ListChrome: @unchecked Sendable {
  var separatorColor: UIColor = .separator
  /// The list ends in a loading footer while the next page is on its way.
  var showsFooter = false
}

/// UIKit recycles the visible SwiftUI cells; loaded row models remain retained. Row operations are
/// decoded off the main thread, while paging and actions call back into the TypeScript owner.
final class ArticleListView: ExpoView, UICollectionViewDelegate {
  let onEndReached = EventDispatcher()
  let onScroll = EventDispatcher()
  let onRefresh = EventDispatcher()
  let onVisibleItemsChange = EventDispatcher()
  let onRowPress = EventDispatcher()
  let onRowPressIn = EventDispatcher()
  let onRowAction = EventDispatcher()

  private let collectionView: UICollectionView
  private let chrome: ListChrome
  private var dataSource: UICollectionViewDiffableDataSource<Int, String>?
  /// The rows on screen, replaced whole by each presentation from the pipeline.
  private var state = ArticleListState()
  private var style: ArticleListStyle?

  /// How many rows from the last one the list asks for the next page. Counting rows, not points,
  /// keeps the trigger exact while cells are still self-sizing and `contentSize` is an estimate.
  private var endReachedDistance = 5
  /// The page an end-reached event was already sent for, so one page triggers one fetch.
  private var endReachedKey: EndReachedKey?
  private let refreshControl = UIRefreshControl()
  private var styleRecord: NSDictionary?
  private var visibleIds: [String] = []
  private var visibilityScheduled = false
  private var hasPositionedInitialOffset = false
  private var scrollToTopToken: Int?

  required init(appContext: AppContext? = nil) {
    let chrome = ListChrome()
    self.chrome = chrome
    // The system list layout draws the dividers: between rows only, inset to the rows' 20pt text
    // margin like every iOS list, rather than edge to edge. Each row draws the divider above it
    // (none on the first), so appending a page never changes a row already on screen.
    let layout = UICollectionViewCompositionalLayout { _, environment in
      var configuration = UICollectionLayoutListConfiguration(appearance: .plain)
      configuration.showsSeparators = true
      configuration.backgroundColor = .clear
      configuration.footerMode = chrome.showsFooter ? .supplementary : .none
      configuration.itemSeparatorHandler = { indexPath, sectionSeparator in
        var separator = sectionSeparator
        separator.color = chrome.separatorColor
        separator.bottomSeparatorVisibility = .hidden
        separator.topSeparatorVisibility = indexPath.item == 0 ? .hidden : .visible
        separator.topSeparatorInsets = NSDirectionalEdgeInsets(top: 0, leading: 20, bottom: 0, trailing: 20)
        return separator
      }
      return NSCollectionLayoutSection.list(using: configuration, layoutEnvironment: environment)
    }
    collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
    super.init(appContext: appContext)

    backgroundColor = .clear
    collectionView.backgroundColor = .clear
    collectionView.delegate = self
    collectionView.allowsSelection = false
    collectionView.alwaysBounceVertical = true
    collectionView.contentInsetAdjustmentBehavior = .never
    collectionView.automaticallyAdjustsScrollIndicatorInsets = false
    addSubview(collectionView)
    refreshControl.addTarget(self, action: #selector(refresh), for: .valueChanged)

    let registration = UICollectionView.CellRegistration<UICollectionViewListCell, String> {
      [weak self] cell, _, id in
      ArticleListSignpost.measure("cell.configure") {
        cell.backgroundConfiguration = .clear()
        cell.automaticallyUpdatesBackgroundConfiguration = false
        guard let self, let row = self.state.rows[id], let style = self.style else { return }
        cell.contentConfiguration = UIHostingConfiguration {
          ArticleRowView(row: row, style: style, actions: self.rowActions).id(row.id)
        }
        .margins(.all, 0)
      }
    }
    dataSource = UICollectionViewDiffableDataSource<Int, String>(collectionView: collectionView) {
      collectionView, indexPath, id in
      collectionView.dequeueConfiguredReusableCell(using: registration, for: indexPath, item: id)
    }
    let footerRegistration = UICollectionView.SupplementaryRegistration<ArticleListFooterView>(
      elementKind: UICollectionView.elementKindSectionFooter
    ) { [weak self] footer, _, _ in
      footer.setColor(self?.style?.loadingColor ?? .secondaryLabel)
    }
    dataSource?.supplementaryViewProvider = { collectionView, _, indexPath in
      collectionView.dequeueConfiguredReusableSupplementary(using: footerRegistration, for: indexPath)
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let anchor = collectionView.bounds.size != bounds.size ? captureAnchor() : nil
    collectionView.frame = bounds
    if anchor != nil { collectionView.layoutIfNeeded(); restoreAnchor(anchor) }
    reportVisibleItems()
  }

  private lazy var pipeline = ArticleRowPipeline { [weak self] presentation in
    await self?.present(presentation)
  }

  private lazy var rowActions = ArticleRowActions(
    press: { [weak self] id in self?.onRowPress(["id": id]) },
    pressIn: { [weak self] id in self?.onRowPressIn(["id": id]) },
    perform: { [weak self] id, action in self?.onRowAction(["id": id, "action": action.rawValue]) }
  )

  // MARK: Props

  // Props arrive one at a time and are applied together by OnViewDidUpdateProps.
  var contentInset: ListInsetsRecord?
  var indicatorInset: ListInsetsRecord?

  func applyInsets() {
    let content = contentInset
    let indicator = indicatorInset ?? content
    setInsets(
      top: CGFloat(content?.top ?? 0),
      bottom: CGFloat(content?.bottom ?? 0),
      indicatorTop: CGFloat(indicator?.top ?? 0),
      indicatorBottom: CGFloat(indicator?.bottom ?? 0)
    )
  }

  /// Queues a JSON array of `ArticleListOp`; the pipeline decodes and reduces it off this thread.
  func applyOps(_ payload: String) {
    pipeline.submit(payload)
  }

  /// Capture an ID, not an index: insertions and deletions above it must not move the article.
  private func captureAnchor(in rows: [String: ArticleRowModel]? = nil) -> (id: String, offset: CGFloat)? {
    guard collectionView.contentOffset.y > -collectionView.adjustedContentInset.top + 1,
      let source = dataSource else { return nil }
    for index in collectionView.indexPathsForVisibleItems.sorted() {
      guard let id = source.itemIdentifier(for: index),
        let frame = collectionView.layoutAttributesForItem(at: index)?.frame,
        rows == nil || rows?[id] != nil else { continue }
      return (id, frame.minY - collectionView.contentOffset.y)
    }
    return nil
  }

  private func restoreAnchor(_ anchor: (id: String, offset: CGFloat)?) {
    guard let anchor, let index = dataSource?.indexPath(for: anchor.id),
      let frame = collectionView.layoutAttributesForItem(at: index)?.frame else { return }
    setOffset(frame.minY - anchor.offset, animated: false)
  }

  /// Shows a state the pipeline has finished reducing.
  private func present(_ presentation: ArticleListPresentation) async {
    let anchor = presentation.scrollToTop ? nil : captureAnchor(in: presentation.state.rows)
    state = presentation.state
    updateFooter()
    if presentation.didChangeRows {
      await withCheckedContinuation { continuation in
        applySnapshot(reconfiguring: presentation.reconfiguredIds,
          structural: presentation.didChangeStructure) { [weak self] in
          if let self {
            self.collectionView.layoutIfNeeded()
            if presentation.scrollToTop { self.scrollToTop() }
            else { self.restoreAnchor(anchor) }
            self.reportVisibleItems()
          }
          continuation.resume()
        }
      }
    } else {
      checkVisibleEnd()
    }
  }

  @objc private func refresh() { onRefresh() }

  func setRefreshEnabled(_ enabled: Bool) {
    guard enabled != (collectionView.refreshControl != nil) else { return }
    collectionView.refreshControl = enabled ? refreshControl : nil
  }

  func setRefreshing(_ refreshing: Bool) {
    if refreshing { if !refreshControl.isRefreshing { refreshControl.beginRefreshing() } }
    else { refreshControl.endRefreshing() }
  }

  @discardableResult
  func scrollToItem(_ id: String, animated: Bool) -> Bool {
    guard let index = dataSource?.indexPath(for: id) else { return false }
    collectionView.scrollToItem(at: index, at: .top, animated: animated)
    return true
  }

  func setOffset(_ y: CGFloat, animated: Bool) {
    let top = -collectionView.adjustedContentInset.top
    let bottom = max(top, collectionView.contentSize.height
      + collectionView.adjustedContentInset.bottom - collectionView.bounds.height)
    collectionView.setContentOffset(CGPoint(x: 0, y: min(bottom, max(top, y))), animated: animated)
  }

  private func reportVisibleItems() {
    let ids = collectionView.indexPathsForVisibleItems.sorted().compactMap {
      dataSource?.itemIdentifier(for: $0)
    }
    guard ids != visibleIds else { return }
    visibleIds = ids
    onVisibleItemsChange(["ids": ids])
  }

  private func updateFooter() {
    let showsFooter = state.paging.hasMore && state.paging.isLoadingMore
    guard chrome.showsFooter != showsFooter else { return }
    chrome.showsFooter = showsFooter
    collectionView.collectionViewLayout.invalidateLayout()
  }

  func setStyle(_ record: ListStyleRecord) {
    let values = record.toDictionary(appContext: nil) as NSDictionary
    guard styleRecord?.isEqual(values) != true else { return }
    styleRecord = values
    let anchor = captureAnchor()
    let next = ArticleListStyle(record)
    style = next
    chrome.separatorColor = next.separatorColor
    refreshControl.tintColor = next.loadingColor
    collectionView.collectionViewLayout.invalidateLayout()
    let visible = collectionView.indexPathsForVisibleItems.compactMap {
      dataSource?.itemIdentifier(for: $0)
    }
    applySnapshot(reconfiguring: visible, structural: false) { [weak self] in
      self?.collectionView.layoutIfNeeded()
      self?.restoreAnchor(anchor)
    }
  }

  func setEndReachedDistance(_ rows: Int) {
    endReachedDistance = max(rows, 0)
    checkVisibleEnd()
  }

  func setInsets(top: CGFloat, bottom: CGFloat, indicatorTop: CGFloat, indicatorBottom: CGFloat) {
    let content = UIEdgeInsets(top: top, left: 0, bottom: bottom, right: 0)
    let indicator = UIEdgeInsets(top: indicatorTop, left: 0, bottom: indicatorBottom, right: 0)
    let wasAtRest = collectionView.contentOffset.y <= -collectionView.adjustedContentInset.top + 0.5
    let changed = collectionView.contentInset != content
    if changed { collectionView.contentInset = content }
    if collectionView.verticalScrollIndicatorInsets != indicator {
      collectionView.verticalScrollIndicatorInsets = indicator
    }
    if !hasPositionedInitialOffset || (changed && wasAtRest) {
      hasPositionedInitialOffset = true
      collectionView.contentOffset = CGPoint(x: 0, y: -collectionView.adjustedContentInset.top)
    }
  }

  func setAdjustsInsetsAutomatically(_ automatic: Bool) {
    collectionView.contentInsetAdjustmentBehavior = automatic ? .automatic : .never
    collectionView.automaticallyAdjustsScrollIndicatorInsets = automatic
  }

  func setScrollToTopToken(_ token: Int) {
    defer { scrollToTopToken = token }
    guard let previous = scrollToTopToken, previous != token else { return }
    scrollToTop()
  }

  private func scrollToTop() {
    let top = -collectionView.adjustedContentInset.top
    collectionView.setContentOffset(CGPoint(x: 0, y: top), animated: false)
  }

  /// Applies `state` to the list. Ids are unique (the reducer guarantees it, as the data source
  /// requires) and `reconfiguredIds` are all listed, so neither needs checking here.
  private func applySnapshot(reconfiguring reconfiguredIds: [String], structural: Bool = true,
    completion: (() -> Void)? = nil) {
    guard let dataSource else { completion?(); return }
    ArticleListSignpost.measure("snapshot.apply") {
      var snapshot = structural ? NSDiffableDataSourceSnapshot<Int, String>() : dataSource.snapshot()
      if structural {
        snapshot.appendSections([0])
        snapshot.appendItems(state.ids)
      }
      if !reconfiguredIds.isEmpty { snapshot.reconfigureItems(reconfiguredIds) }
      dataSource.apply(snapshot, animatingDifferences: false) { [weak self] in
        // Rows that were already on screen are not displayed again, so a list that is still short
        // after a filter, or a page that changed nothing, asks for its next page here.
        completion?()
        self?.checkVisibleEnd()
      }
    }
  }

  // MARK: Scrolling

  /// Every frame, at the display's rate (120Hz on ProMotion): Reanimated takes the event on the UI
  /// thread, so the header and the tab bar follow the list without crossing to JS.
  func scrollViewDidScroll(_ scrollView: UIScrollView) {
    emitScroll(scrollView)
  }

  func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
    // A failed page fetch retries once the user scrolls again; JS ignores the event while a
    // fetch is still in flight. A drag that starts at the end shows no new row, so it checks itself.
    endReachedKey = nil
    checkVisibleEnd()
  }

  func collectionView(
    _ collectionView: UICollectionView, willDisplay cell: UICollectionViewCell,
    forItemAt indexPath: IndexPath
  ) {
    checkEndReached(lastVisibleItem: indexPath.item)
    scheduleVisibilityReport()
  }

  func collectionView(_ collectionView: UICollectionView, didEndDisplaying cell: UICollectionViewCell,
    forItemAt indexPath: IndexPath) {
    scheduleVisibilityReport()
  }

  private func scheduleVisibilityReport() {
    guard !visibilityScheduled else { return }
    visibilityScheduled = true
    DispatchQueue.main.async { [weak self] in
      self?.visibilityScheduled = false
      self?.reportVisibleItems()
    }
  }

  func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) {
    emitScroll(scrollView)
  }

  func scrollViewDidEndDragging(_ scrollView: UIScrollView, willDecelerate decelerate: Bool) {
    if !decelerate { emitScroll(scrollView) }
  }

  /// `maxY` is the offset at which the list rests at its end; offsets past it are rubber-banding.
  private func emitScroll(_ scrollView: UIScrollView) {
    let maxY = scrollView.contentSize.height + scrollView.adjustedContentInset.bottom - scrollView.bounds.height
    onScroll(["y": scrollView.contentOffset.y, "maxY": maxY])
  }

  // MARK: Paging

  /// Which page the list last asked for. The epoch restarts it for a new data set; the page count
  /// advances with every page that arrives, so a page whose rows were all filtered out still lets
  /// the list ask for the next one.
  private struct EndReachedKey: Equatable {
    let epoch: Int
    let pageCount: Int
  }

  private func checkVisibleEnd() {
    guard let lastVisible = collectionView.indexPathsForVisibleItems.map(\.item).max() else { return }
    checkEndReached(lastVisibleItem: lastVisible)
  }

  /// Asks for the next page once a row within `endReachedDistance` of the last is on screen: once
  /// per page, and not while a page is already loading.
  private func checkEndReached(lastVisibleItem: Int) {
    let paging = state.paging
    let rowCount = state.ids.count
    guard paging.hasMore, !paging.isLoadingMore, rowCount > 0 else { return }
    guard lastVisibleItem >= rowCount - 1 - endReachedDistance else { return }
    let key = EndReachedKey(epoch: state.epoch, pageCount: paging.pageCount)
    guard endReachedKey != key else { return }
    endReachedKey = key
    onEndReached()
  }
}

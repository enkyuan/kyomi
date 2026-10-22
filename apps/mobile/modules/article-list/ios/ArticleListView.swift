import ExpoModulesCore
import SwiftUI
import UIKit

/// A `UICollectionView` of SwiftUI rows. Virtualisation, cell reuse, self-sizing and diffing are all
/// UIKit's, so memory stays flat however far the list has paged. React Native supplies the theme
/// and a stream of row operations (`applyOps`), which `ArticleRowPipeline` reduces off the main
/// thread; scrolling, paging and touches never wait on the JS thread.
/// What the list layout reads when it asks for each item's separators.
final class ListChrome: @unchecked Sendable {
  var separatorColor: UIColor = .separator
}

final class ArticleListView: ExpoView, UICollectionViewDelegate {
  let onEndReached = EventDispatcher()
  let onScroll = EventDispatcher()
  let onRowPress = EventDispatcher()
  let onRowPressIn = EventDispatcher()
  let onRowAction = EventDispatcher()

  private let collectionView: UICollectionView
  private let chrome: ListChrome
  private var dataSource: UICollectionViewDiffableDataSource<Int, String>?
  /// The rows on screen, replaced whole by each presentation from the pipeline.
  private var state = ArticleListState()
  private var style: ArticleListStyle?

  private var hasMore = false
  private var endReachedThreshold: CGFloat = 0.5
  /// Row count an end-reached event was already sent for, so one page triggers one fetch.
  private var endReachedRowCount = -1
  private var contentInsetTop: CGFloat = 0
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

    let registration = UICollectionView.CellRegistration<UICollectionViewListCell, String> {
      [weak self] cell, _, id in
      ArticleListSignpost.measure("cell.configure") {
        cell.backgroundConfiguration = .clear()
        cell.automaticallyUpdatesBackgroundConfiguration = false
        guard let self, let row = self.state.rows[id], let style = self.style else { return }
        cell.contentConfiguration = UIHostingConfiguration {
          ArticleRowView(row: row, style: style, actions: self.rowActions)
        }
        .margins(.all, 0)
      }
    }
    dataSource = UICollectionViewDiffableDataSource<Int, String>(collectionView: collectionView) {
      collectionView, indexPath, id in
      collectionView.dequeueConfiguredReusableCell(using: registration, for: indexPath, item: id)
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    collectionView.frame = bounds
  }

  private lazy var pipeline = ArticleRowPipeline { [weak self] presentation in
    self?.present(presentation)
  }

  private lazy var rowActions = ArticleRowActions(
    press: { [weak self] id in self?.onRowPress(["id": id]) },
    pressIn: { [weak self] id in self?.onRowPressIn(["id": id]) },
    perform: { [weak self] id, action in self?.onRowAction(["id": id, "action": action.rawValue]) }
  )

  // MARK: Props

  // Props arrive one at a time, so related values are collected and applied together.
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

  /// Shows a state the pipeline has finished reducing.
  private func present(_ presentation: ArticleListPresentation) {
    state = presentation.state
    // A new data set starts paging over: its end has not been reported yet.
    if presentation.didReset { endReachedRowCount = -1 }
    applySnapshot(reconfiguring: presentation.reconfiguredIds)
    if presentation.scrollToTop { scrollToTop() }
  }

  func setStyle(_ next: ArticleListStyle) {
    style = next
    chrome.separatorColor = next.separatorColor
    collectionView.collectionViewLayout.invalidateLayout()
    // Cells read the current style when they are configured, so only the ones on screen are stale.
    let visibleIds = collectionView.indexPathsForVisibleItems.compactMap {
      dataSource?.itemIdentifier(for: $0)
    }
    applySnapshot(reconfiguring: visibleIds)
  }

  func setHasMore(_ hasMore: Bool) {
    self.hasMore = hasMore
    checkEndReached()
  }

  func setEndReachedThreshold(_ threshold: Double) {
    endReachedThreshold = CGFloat(threshold)
    checkEndReached()
  }

  func setInsets(top: CGFloat, bottom: CGFloat, indicatorTop: CGFloat, indicatorBottom: CGFloat) {
    let wasAtRest = collectionView.contentOffset.y <= -collectionView.contentInset.top + 0.5
    collectionView.contentInset = UIEdgeInsets(top: top, left: 0, bottom: bottom, right: 0)
    collectionView.verticalScrollIndicatorInsets = UIEdgeInsets(top: indicatorTop, left: 0, bottom: indicatorBottom, right: 0)
    contentInsetTop = top
    // The list opens, and keeps resting, beneath the floating header.
    if !hasPositionedInitialOffset || wasAtRest {
      hasPositionedInitialOffset = true
      collectionView.contentOffset = CGPoint(x: 0, y: -top)
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
  private func applySnapshot(reconfiguring reconfiguredIds: [String]) {
    guard let dataSource else { return }
    ArticleListSignpost.measure("snapshot.apply") {
      var snapshot = NSDiffableDataSourceSnapshot<Int, String>()
      snapshot.appendSections([0])
      snapshot.appendItems(state.ids)
      if !reconfiguredIds.isEmpty { snapshot.reconfigureItems(reconfiguredIds) }
      dataSource.apply(snapshot, animatingDifferences: false) { [weak self] in
        guard let self else { return }
        // A list shorter than the screen can never be scrolled, so it asks for its next page itself.
        // Scrolling lists wait for the user: cells are self-sized, so content height is only an
        // estimate until rows have been laid out.
        if self.collectionView.contentSize.height <= self.collectionView.bounds.height {
          self.checkEndReached()
        }
      }
    }
  }

  // MARK: Scrolling

  /// Every frame, at the display's rate (120Hz on ProMotion): Reanimated takes the event on the UI
  /// thread, so the header and the tab bar follow the list without crossing to JS.
  func scrollViewDidScroll(_ scrollView: UIScrollView) {
    emitScroll(scrollView)
    if scrollView.isTracking || scrollView.isDecelerating { checkEndReached() }
  }

  func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
    // A failed page fetch retries once the user scrolls again; JS ignores the event while a
    // fetch is still in flight.
    endReachedRowCount = -1
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

  private func checkEndReached() {
    let rowCount = state.ids.count
    guard hasMore, rowCount > 0, collectionView.bounds.height > 0 else { return }
    let visibleBottom = collectionView.contentOffset.y + collectionView.bounds.height - collectionView.contentInset.bottom
    let remaining = collectionView.contentSize.height - visibleBottom
    guard remaining < endReachedThreshold * collectionView.bounds.height else { return }
    guard endReachedRowCount != rowCount else { return }
    endReachedRowCount = rowCount
    onEndReached()
  }
}

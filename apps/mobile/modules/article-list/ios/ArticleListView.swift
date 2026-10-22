import ExpoModulesCore
import SwiftUI
import UIKit

/// A `UICollectionView` of SwiftUI rows. Virtualisation, cell reuse, self-sizing and diffing are all
/// UIKit's, so memory stays flat however far the list has paged. React Native only supplies row
/// data and the theme; scrolling, paging and touches never wait on the JS thread.
final class ArticleListView: ExpoView, UICollectionViewDelegate {
  let onEndReached = EventDispatcher()
  let onScroll = EventDispatcher()
  let onRowPress = EventDispatcher()
  let onRowPressIn = EventDispatcher()
  let onRowAction = EventDispatcher()

  private let collectionView: UICollectionView
  private var dataSource: UICollectionViewDiffableDataSource<Int, String>?
  private var rows: [ArticleRowModel] = []
  private var rowsById: [String: ArticleRowModel] = [:]
  private var style: ArticleListStyle?

  private var hasMore = false
  private var isFetching = false
  private var endReachedThreshold: CGFloat = 0.5
  /// Row count an end-reached event was already sent for, so one page triggers one fetch.
  private var endReachedRowCount = -1
  private var lastScrollEvent: CFTimeInterval = 0
  private var contentInsetTop: CGFloat = 0
  private var hasPositionedInitialOffset = false
  private var scrollToTopToken: Int?

  required init(appContext: AppContext? = nil) {
    var configuration = UICollectionLayoutListConfiguration(appearance: .plain)
    configuration.showsSeparators = false
    configuration.backgroundColor = .clear
    collectionView = UICollectionView(
      frame: .zero,
      collectionViewLayout: UICollectionViewCompositionalLayout.list(using: configuration)
    )
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
      cell.backgroundConfiguration = .clear()
      cell.automaticallyUpdatesBackgroundConfiguration = false
      guard let self, let row = self.rowsById[id], let style = self.style else { return }
      cell.contentConfiguration = UIHostingConfiguration {
        ArticleRowView(row: row, style: style, actions: self.rowActions)
      }
      .margins(.all, 0)
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

  private lazy var rowActions = ArticleRowActions(
    press: { [weak self] id in self?.onRowPress(["id": id]) },
    pressIn: { [weak self] id in self?.onRowPressIn(["id": id]) },
    perform: { [weak self] id, action in self?.onRowAction(["id": id, "action": action.rawValue]) }
  )

  // MARK: Props

  // Props arrive one at a time, so related values are collected and applied together.
  var contentInset: ListInsetsRecord?
  var indicatorInset: ListInsetsRecord?
  var pagingHasMore = false
  var pagingIsFetching = false
  var pagingThreshold = 0.5

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

  func applyPaging() {
    setPaging(hasMore: pagingHasMore, isFetching: pagingIsFetching, threshold: pagingThreshold)
  }

  func setRows(_ models: [ArticleRowModel]) {
    var next = models
    for index in next.indices { next[index].isFirst = index == 0 }

    let previous = rowsById
    rows = next
    rowsById = Dictionary(next.map { ($0.id, $0) }, uniquingKeysWith: { _, last in last })
    applySnapshot(changedIds: next.compactMap { previous[$0.id] != nil && previous[$0.id] != $0 ? $0.id : nil })
  }

  func setStyle(_ next: ArticleListStyle) {
    style = next
    applySnapshot(changedIds: rows.map(\.id))
  }

  func setPaging(hasMore: Bool, isFetching: Bool, threshold: Double) {
    self.hasMore = hasMore
    self.isFetching = isFetching
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
    let top = -collectionView.adjustedContentInset.top
    collectionView.setContentOffset(CGPoint(x: 0, y: top), animated: false)
  }

  private func applySnapshot(changedIds: [String]) {
    guard let dataSource else { return }
    var snapshot = NSDiffableDataSourceSnapshot<Int, String>()
    snapshot.appendSections([0])
    // Identifiers must be unique; a repeated id would trap the data source.
    var seen = Set<String>()
    let ids = rows.map(\.id).filter { seen.insert($0).inserted }
    snapshot.appendItems(ids)
    let existing = Set(dataSource.snapshot().itemIdentifiers)
    let reconfigure = changedIds.filter { existing.contains($0) && seen.contains($0) }
    if !reconfigure.isEmpty { snapshot.reconfigureItems(reconfigure) }
    dataSource.apply(snapshot, animatingDifferences: false) { [weak self] in
      self?.checkEndReached()
    }
  }

  // MARK: Scrolling

  func scrollViewDidScroll(_ scrollView: UIScrollView) {
    let now = CACurrentMediaTime()
    if now - lastScrollEvent >= 1.0 / 60.0 {
      lastScrollEvent = now
      onScroll(["y": scrollView.contentOffset.y])
    }
    checkEndReached()
  }

  func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
    // A failed page fetch retries once the user scrolls again.
    if !isFetching { endReachedRowCount = -1 }
  }

  func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) {
    onScroll(["y": scrollView.contentOffset.y])
  }

  func scrollViewDidEndDragging(_ scrollView: UIScrollView, willDecelerate decelerate: Bool) {
    if !decelerate { onScroll(["y": scrollView.contentOffset.y]) }
  }

  private func checkEndReached() {
    guard hasMore, !isFetching, !rows.isEmpty, collectionView.bounds.height > 0 else { return }
    let visibleBottom = collectionView.contentOffset.y + collectionView.bounds.height - collectionView.contentInset.bottom
    let remaining = collectionView.contentSize.height - visibleBottom
    guard remaining < endReachedThreshold * collectionView.bounds.height else { return }
    guard endReachedRowCount != rows.count else { return }
    endReachedRowCount = rows.count
    onEndReached()
  }
}

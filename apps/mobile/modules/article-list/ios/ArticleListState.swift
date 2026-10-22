import Foundation

/// A change to the list, as JavaScript sends it (`ArticleListOp` in `types.ts`). Operations arrive
/// in batches and apply in order.
enum ArticleListOp: Sendable {
  /// Replaces every row. `epoch` counts resets, so the list can tell a new data set from a longer one.
  case reset(epoch: Int, rows: [ArticleRowModel], scrollToTop: Bool)
  /// Adds rows after the last one; a row whose id is already listed is updated in place.
  case append(rows: [ArticleRowModel])
  /// Replaces the content of listed rows; ids that are not listed are ignored.
  case update(rows: [ArticleRowModel])
  case remove(ids: [String])
  /// Where paging stands. It travels with the rows so the list never sees one without the other:
  /// a page counted before its rows arrive would look like a page that added nothing.
  case paging(ArticleListPaging)
}

extension ArticleListOp: Decodable {
  private enum CodingKeys: String, CodingKey {
    case type, epoch, rows, ids, scrollToTop, pageCount, hasMore, isLoadingMore
  }

  init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    switch try container.decode(String.self, forKey: .type) {
    case "reset":
      self = .reset(
        epoch: try container.decode(Int.self, forKey: .epoch),
        rows: try container.decode([ArticleRowWire].self, forKey: .rows).map(\.model),
        scrollToTop: try container.decodeIfPresent(Bool.self, forKey: .scrollToTop) ?? false
      )
    case "append":
      self = .append(rows: try container.decode([ArticleRowWire].self, forKey: .rows).map(\.model))
    case "update":
      self = .update(rows: try container.decode([ArticleRowWire].self, forKey: .rows).map(\.model))
    case "remove":
      self = .remove(ids: try container.decode([String].self, forKey: .ids))
    case "paging":
      self = .paging(
        ArticleListPaging(
          pageCount: try container.decode(Int.self, forKey: .pageCount),
          hasMore: try container.decode(Bool.self, forKey: .hasMore),
          isLoadingMore: try container.decode(Bool.self, forKey: .isLoadingMore)
        ))
    default:
      throw DecodingError.dataCorruptedError(
        forKey: .type, in: container, debugDescription: "Unknown article list operation")
    }
  }
}

/// Paging as JavaScript's query reports it. The list reads it to decide when to ask for a page and
/// whether to show the loading footer; the fetching itself stays in JavaScript.
struct ArticleListPaging: Equatable, Sendable {
  /// Pages fetched so far. It grows by one for every page that arrives, including one whose rows
  /// are all filtered out, so each page re-arms the end trigger.
  var pageCount = 0
  var hasMore = false
  var isLoadingMore = false
}

/// What the list shows. It only ever changes through `reduce`, on the worker queue; the main thread
/// receives finished copies.
struct ArticleListState: Sendable {
  /// Row ids in display order, each listed once.
  private(set) var ids: [String] = []
  private(set) var rows: [String: ArticleRowModel] = [:]
  private(set) var epoch = -1
  private(set) var paging = ArticleListPaging()

  /// Applies `ops` in order. Returns what the main thread must present, or `nil` when nothing in
  /// the list changed (an update that repeats a row's content, a remove of unknown ids).
  mutating func reduce(_ ops: [ArticleListOp]) -> ArticleListPresentation? {
    var didChangeRows = false
    var didChangePaging = false
    var didReset = false
    var scrollToTop = false
    // Rows that stay in the list with new content. A row written twice in one batch may be
    // reconfigured without needing it; one that needs it is never missed.
    var changed = Set<String>()

    for op in ops {
      switch op {
      case let .reset(epoch, newRows, top):
        var nextIds: [String] = []
        nextIds.reserveCapacity(newRows.count)
        var nextRows: [String: ArticleRowModel] = Dictionary(minimumCapacity: newRows.count)
        for row in newRows {
          // A repeated id would trap the diffable data source; the last copy wins.
          if nextRows.updateValue(row, forKey: row.id) == nil { nextIds.append(row.id) }
        }
        changed = changed.filter { nextRows[$0] != nil }
        for id in nextIds where rows[id] != nil && rows[id] != nextRows[id] { changed.insert(id) }
        ids = nextIds
        rows = nextRows
        self.epoch = epoch
        didChangeRows = true
        didReset = true
        scrollToTop = top

      case let .append(newRows):
        for row in newRows {
          switch rows.updateValue(row, forKey: row.id) {
          case nil:
            ids.append(row.id)
            didChangeRows = true
          case let old? where old != row:
            changed.insert(row.id)
            didChangeRows = true
          default:
            break
          }
        }

      case let .update(newRows):
        for row in newRows {
          guard let old = rows[row.id], old != row else { continue }
          rows[row.id] = row
          changed.insert(row.id)
          didChangeRows = true
        }

      case let .remove(removedIds):
        let gone = Set(removedIds).filter { rows[$0] != nil }
        guard !gone.isEmpty else { continue }
        ids.removeAll { gone.contains($0) }
        for id in gone { rows[id] = nil }
        changed.subtract(gone)
        didChangeRows = true

      case let .paging(next):
        guard next != paging else { continue }
        paging = next
        didChangePaging = true
      }
    }

    guard didChangeRows || didChangePaging else { return nil }
    return ArticleListPresentation(
      state: self,
      reconfiguredIds: Array(changed),
      didChangeRows: didChangeRows,
      didReset: didReset,
      scrollToTop: scrollToTop
    )
  }
}

/// A finished state for the main thread to show.
struct ArticleListPresentation: Sendable {
  let state: ArticleListState
  /// Listed rows whose content changed, to reconfigure in place.
  let reconfiguredIds: [String]
  /// Rows were added, removed, replaced or edited, so the snapshot needs applying. A batch that
  /// only moved paging skips the diff.
  let didChangeRows: Bool
  /// The batch replaced every row.
  let didReset: Bool
  let scrollToTop: Bool
}

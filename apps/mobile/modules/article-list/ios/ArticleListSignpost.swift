import Foundation
import os

/// Timing for the list's hot paths, readable in Instruments (Points of Interest, or the os_signpost
/// instrument filtered to this subsystem). Intervals:
///
/// - `ops.decode` / `ops.reduce`: worker queue, per batch of operations from JavaScript
/// - `snapshot.apply`: main thread, building and applying the diffable snapshot
/// - `cell.configure`: main thread, once per cell the list configures while scrolling
///
/// `ops.enqueue` is an event on the main thread carrying the payload size of each batch.
enum ArticleListSignpost {
  private static let subsystem = Bundle.main.bundleIdentifier ?? "Kyomi"

  static let signposter = OSSignposter(
    logHandle: OSLog(subsystem: subsystem, category: .pointsOfInterest)
  )
  static let logger = Logger(subsystem: subsystem, category: "ArticleList")

  /// Runs `body` inside a named interval. Names are static so Instruments can group them.
  @discardableResult
  static func measure<T>(_ name: StaticString, _ body: () throws -> T) rethrows -> T {
    let id = signposter.makeSignpostID()
    let state = signposter.beginInterval(name, id: id)
    defer { signposter.endInterval(name, state) }
    return try body()
  }
}

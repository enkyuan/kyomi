import Foundation
import Synchronization

/// Takes list operations from JavaScript, decodes and reduces them into an `ArticleListState` on a
/// worker, and hands each finished state to `present` on the main actor. The main thread never
/// parses a row, hashes the whole list or compares old and new rows: its share of an update is
/// building the snapshot and letting UIKit apply it.
///
/// Batches are processed in the order they were submitted. Batches that arrive while one is being
/// presented are reduced together and presented once.
final class ArticleRowPipeline: Sendable {
  private let inbox: Inbox
  private let signal: AsyncStream<Void>.Continuation
  private let worker: Task<Void, Never>

  init(present: @escaping @MainActor @Sendable (ArticleListPresentation) async -> Void) {
    let (signals, signal) = AsyncStream.makeStream(of: Void.self, bufferingPolicy: .bufferingNewest(1))
    let inbox = Inbox()
    self.inbox = inbox
    self.signal = signal
    // A detached root keeps this loop off the main actor, which is the point of the pipeline. The
    // state lives only in the loop, so nothing here is shared.
    worker = Task.detached(priority: .userInitiated) {
      var state = ArticleListState()
      for await _ in signals {
        guard let presentation = Self.process(inbox.drain(), into: &state) else { continue }
        await present(presentation)
      }
    }
  }

  deinit {
    signal.finish()
    worker.cancel()
  }

  /// `payload` is a JSON array of operations (`ArticleListOp`). Safe to call from any thread.
  func submit(_ payload: String) {
    ArticleListSignpost.signposter.emitEvent(
      "ops.enqueue", "\(payload.utf8.count, privacy: .public) bytes")
    inbox.push(payload)
    signal.yield()
  }

  private static func process(
    _ payloads: [String], into state: inout ArticleListState
  ) -> ArticleListPresentation? {
    guard !payloads.isEmpty else { return nil }
    let ops = ArticleListSignpost.measure("ops.decode") {
      payloads.flatMap { decode($0) }
    }
    return ArticleListSignpost.measure("ops.reduce") { state.reduce(ops) }
  }

  private static func decode(_ payload: String) -> [ArticleListOp] {
    do {
      return try JSONDecoder().decode([ArticleListOp].self, from: Data(payload.utf8))
    } catch {
      // JavaScript builds every payload, so a failure here is a bug in one of the two sides; the
      // list would silently stop matching its data.
      ArticleListSignpost.logger.error("Dropped malformed list operations: \(error)")
      assertionFailure("Malformed list operations: \(error)")
      return []
    }
  }
}

/// Payloads waiting for the worker, in arrival order.
private final class Inbox: Sendable {
  private let payloads = Mutex<[String]>([])

  func push(_ payload: String) {
    payloads.withLock { $0.append(payload) }
  }

  func drain() -> [String] {
    payloads.withLock { batch in
      let drained = batch
      batch = []
      return drained
    }
  }
}

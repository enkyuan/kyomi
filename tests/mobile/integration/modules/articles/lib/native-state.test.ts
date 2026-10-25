import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Execute the production reducer, wire models and asynchronous pipeline. The simulator build
// separately checks UIKit/SwiftUI compilation; this test does not prove on-screen behavior.
test.skipIf(process.platform !== "darwin")(
  "native reducer and pipeline distinguish content updates and preserve batch order",
  () => {
    const root = new URL("../../../../../../", import.meta.url);
    const models = readFileSync(
      new URL("apps/mobile/modules/article-list/ios/ArticleListModels.swift", root),
      "utf8",
    )
      .split("// MARK: - Style")[0]!
      .replace(/^import (ExpoModulesCore|SwiftUI|TabBar|UIKit)\n/gm, "");
    const reducer = readFileSync(
      new URL("apps/mobile/modules/article-list/ios/ArticleListState.swift", root),
      "utf8",
    );
    const pipeline = readFileSync(
      new URL("apps/mobile/modules/article-list/ios/ArticleRowPipeline.swift", root),
      "utf8",
    );
    const signposts = readFileSync(
      new URL("apps/mobile/modules/article-list/ios/ArticleListSignpost.swift", root),
      "utf8",
    );
    const temp = mkdtempSync(join(tmpdir(), "kyomi-list-state-"));
    try {
      const path = join(temp, "main.swift");
      writeFileSync(
        path,
        `import Foundation\n${models}\n${reducer}\n${signposts}\n${pipeline}\n
func wire(_ id: String, title: String = "title", label: String? = nil) -> ArticleRowModel {
  ArticleRowModel(id: id, kind: .article, sourceLabel: "source", timeLabel: "1h", title: title,
    summary: "", faviconUrls: [], isSaved: false, isContinuing: false, continueLabel: label)
}
func require(_ condition: Bool, _ message: String) {
  if !condition { fatalError(message) }
}
var state = ArticleListState()
let first = state.reduce([.reset(epoch: 1, rows: [wire("a"), wire("b")], scrollToTop: false)])!
require(first.didChangeStructure, "initial IDs require a snapshot")
let edit = state.reduce([.update(rows: [wire("b", title: "saved")])])!
require(!edit.didChangeStructure, "content update must reuse snapshot")
require(edit.reconfiguredIds == ["b"], "only changed row reconfigured")
require(state.reduce([.update(rows: [wire("b", title: "saved")])]) == nil, "unchanged row is a no-op")
let relabeled = state.reduce([.update(rows: [wire("b", title: "saved", label: "Continue reading · 6 min left")])])!
require(!relabeled.didChangeStructure && relabeled.reconfiguredIds == ["b"], "a new continue label alone reconfigures its row")
let page = state.reduce([.append(rows: [wire("b", title: "newer"), wire("c")]),
  .paging(ArticleListPaging(pageCount: 2, hasMore: true, isLoadingMore: false))])!
require(page.state.ids == ["a", "b", "c"], "append must dedupe IDs")
require(page.didChangeStructure, "append changes structure")
let removed = state.reduce([.update(rows: [wire("a", title: "changed")]), .remove(ids: ["a"])])!
require(!removed.reconfiguredIds.contains("a"), "deleted IDs cannot be reconfigured")
let reordered = state.reduce([.reset(epoch: 2, rows: [wire("c"), wire("b")], scrollToTop: true)])!
require(reordered.didChangeStructure && reordered.scrollToTop, "dataset reset must reach presentation")
let duplicate = state.reduce([.reset(epoch: 3, rows: [wire("a"), wire("a", title: "last")], scrollToTop: false)])!
require(duplicate.state.ids == ["a"] && duplicate.state.rows["a"]?.title == "last", "last duplicate wins")
let paging = state.reduce([.paging(ArticleListPaging(pageCount: 3, hasMore: true, isLoadingMore: false))])!
require(!paging.didChangeRows && !paging.didChangeStructure, "paging-only update must not rebuild rows")
let payload = #"[{"type":"reset","epoch":4,"rows":[{"id":"x","kind":"article","sourceLabel":"source","timeLabel":"1h","title":"X","faviconUrls":[],"isContinuing":true,"continueLabel":"Continue reading · 2 min left"}]},{"type":"paging","pageCount":1,"hasMore":false,"isLoadingMore":false}]"#
let decoded = try JSONDecoder().decode([ArticleListOp].self, from: Data(payload.utf8))
let decodedState = state.reduce(decoded)
require(decodedState?.state.ids == ["x"], "real wire protocol must decode")
require(decodedState?.state.rows["x"]?.continueLabel == "Continue reading · 2 min left", "continueLabel must decode")
@MainActor final class Collector {
  var presenting = false
  var ids: [String] = []
}
let collector = Collector()
let pipeline = ArticleRowPipeline { presentation in
  require(!collector.presenting, "native presentations must not overlap")
  collector.presenting = true
  try? await Task.sleep(for: .milliseconds(20))
  collector.ids = presentation.state.ids
  collector.presenting = false
}
pipeline.submit(payload)
pipeline.submit(#"[{"type":"append","rows":[{"id":"y","kind":"article","sourceLabel":"source","timeLabel":"1h","title":"Y","faviconUrls":[]}]}]"#)
for _ in 0..<100 {
  if collector.ids == ["x", "y"] { break }
  try await Task.sleep(for: .milliseconds(20))
}
require(collector.ids == ["x", "y"], "pipeline must preserve submission order and deliver the latest rows")
try Data("native reducer contracts passed".utf8).write(to: URL(fileURLWithPath: ${JSON.stringify(join(temp, "passed"))}))
`,
      );
      const executable = join(temp, "native-state");
      const compiled = Bun.spawnSync(
        ["xcrun", "swiftc", "-swift-version", "6", path, "-o", executable],
        { stdout: "pipe", stderr: "pipe" },
      );
      expect(compiled.stderr.toString()).not.toContain("error:");
      expect(compiled.exitCode).toBe(0);
      const result = Bun.spawnSync([executable], { stdout: "pipe", stderr: "pipe" });
      expect(result.stderr.toString()).not.toContain("error:");
      expect(result.exitCode).toBe(0);
      expect(readFileSync(join(temp, "passed"), "utf8")).toBe("native reducer contracts passed");
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  },
  30_000,
);

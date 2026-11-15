import ExpoModulesCore
import SwiftUI

public class TabBarModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TabBar")

    // Geometry React Native needs to place the bar and inset content.
    Constant("containerHeight") { Double(TabBarMetrics.containerHeight) }
    Constant("edgeInset") { Double(TabBarMetrics.edgeInset) }
    Constant("keyboardGap") { Double(TabBarMetrics.keyboardGap) }

    View(TabBarView.self) {
      Events(
        "onTabPress", "onSearchActiveChange", "onSearchQueryChange", "onSearchSubmit",
        "onComposerActiveChange", "onComposerQueryChange", "onComposerSubmit",
        "onSwitcherFolderAction", "onReaderToolPress", "onReaderFontSizeChange"
      )

      Prop("tabs") { (view: TabBarView, tabs: [TabItemRecord]) in
        view.model.tabs = tabs.map(\.item)
      }

      Prop("selectedIndex") { (view: TabBarView, selectedIndex: Int) in
        view.model.selectedIndex = selectedIndex
      }

      Prop("switcher") { (view: TabBarView, switcher: SwitcherRecord?) in
        view.model.switcher = switcher?.switcher
      }

      Prop("switcherFolders") { (view: TabBarView, folders: [SwitcherFolderRecord]?) in
        view.model.switcherFolders = (folders ?? []).map(\.folder)
      }

      Prop("switcherFeeds") { (view: TabBarView, feeds: [SwitcherFeedRecord]?) in
        view.model.switcherFeeds = (feeds ?? []).map(\.feed)
      }

      Prop("searchIcon") { (view: TabBarView, icon: IconRecord?) in
        view.model.searchIcon = icon?.icon
      }

      Prop("composerIcon") { (view: TabBarView, icon: IconRecord?) in
        view.model.composerIcon = icon?.icon
      }

      Prop("composerAddIcon") { (view: TabBarView, icon: IconRecord?) in
        view.model.composerAddIcon = icon?.icon
      }

      Prop("composerAddedIcon") { (view: TabBarView, icon: IconRecord?) in
        view.model.composerAddedIcon = icon?.icon
      }

      Prop("addIcon") { (view: TabBarView, icon: IconRecord?) in
        view.model.addIcon = icon?.icon
      }

      Prop("addIconColor") { (view: TabBarView, color: UIColor?) in
        view.model.addIconColor = color.map { Color(uiColor: $0) } ?? Color.black.opacity(0.85)
      }

      Prop("minimized") { (view: TabBarView, minimized: Bool?) in
        view.model.minimized = minimized ?? false
      }

      Prop("activeTintColor") { (view: TabBarView, color: UIColor?) in
        view.model.activeTint = color.map { Color(uiColor: $0) } ?? .accentColor
      }

      Prop("composerKind") { (view: TabBarView, kind: String?) in
        view.model.composerKind = kind.flatMap(ComposerKind.init(rawValue:)) ?? .follow
      }

      Prop("composerFeeds") { (view: TabBarView, feeds: [ComposerFeedRecord]?) in
        view.model.composerFeeds = (feeds ?? []).map(\.feed)
      }

      Prop("composerFolders") { (view: TabBarView, folders: [ComposerFolderRecord]?) in
        view.model.composerFolders = (folders ?? []).map(\.folder)
      }

      Prop("composerMessage") { (view: TabBarView, message: String?) in
        view.model.composerMessage = message
      }

      Prop("composerStatus") { (view: TabBarView, status: String?) in
        view.model.composerStatus = status.flatMap(ComposerStatus.init(rawValue:)) ?? .idle
      }

      // The reader's tools; omitted, the capsule is the tab bar.
      Prop("reader") { (view: TabBarView, reader: ReaderRecord?) in
        view.model.applyReader(reader?.state)
      }

      Prop("searchPlaceholder") { (view: TabBarView, placeholder: String?) in
        view.model.searchPlaceholder = placeholder ?? "Search"
      }
    }
  }
}

struct IconPathRecord: Record {
  @Field var d: String = ""
  @Field var fillRule: String? = nil
  /// Set for line glyphs, in viewBox units; omitted for filled paths.
  @Field var strokeWidth: Double? = nil
}

struct IconRecord: Record {
  @Field var viewBox: String = "0 0 24 24"
  /// Clockwise rotation in degrees.
  @Field var rotation: Double = 0
  @Field var paths: [IconPathRecord] = []

  var icon: TabBarIcon {
    TabBarIcon(viewBox: viewBox, rotation: rotation, paths: paths.map { (d: $0.d, evenOdd: $0.fillRule == "evenodd", strokeWidth: $0.strokeWidth.map { CGFloat($0) }) })
  }
}

struct TabItemRecord: Record {
  @Field var key: String = ""
  @Field var label: String = ""
  @Field var icon: IconRecord = IconRecord()
  @Field var selectedIcon: IconRecord = IconRecord()

  var item: TabBarItem {
    TabBarItem(id: key, label: label, icon: icon.icon, selectedIcon: selectedIcon.icon)
  }
}

struct SwitcherRecord: Record {
  @Field var title: String = ""
  @Field var label: String = ""
  @Field var hint: String = ""
  @Field var icon: IconRecord = IconRecord()
  @Field var editIcon: IconRecord = IconRecord()
  @Field var sortIcon: IconRecord = IconRecord()
  @Field var addIcon: IconRecord = IconRecord()

  var switcher: TabBarSwitcher {
    TabBarSwitcher(
      title: title, label: label, hint: hint, icon: icon.icon,
      editIcon: editIcon.icon, sortIcon: sortIcon.icon, addIcon: addIcon.icon
    )
  }
}

struct SwitcherFolderRecord: Record {
  @Field var id: String = ""
  @Field var name: String = ""
  @Field var feedCount: Int = 0
  @Field var createdAt: String = ""

  var folder: SwitcherFolder {
    SwitcherFolder(id: id, name: name, feedCount: feedCount, createdAt: Self.date(createdAt))
  }

  /// Instants arrive as ISO 8601, with or without fractional seconds.
  private static func date(_ value: String) -> Date {
    let plain = ISO8601DateFormatter()
    let fractional = ISO8601DateFormatter()
    fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return fractional.date(from: value) ?? plain.date(from: value) ?? .distantPast
  }
}

struct SwitcherFeedRecord: Record {
  @Field var id: String = ""
  @Field var folderId: String = ""
  @Field var title: String = ""
  @Field var faviconUrl: String? = nil

  var feed: SwitcherFeed {
    SwitcherFeed(id: id, folderID: folderId, title: title, faviconURL: faviconUrl.flatMap(URL.init(string:)))
  }
}

struct ComposerFeedRecord: Record {
  @Field var id: String = ""
  @Field var feedId: String? = nil
  @Field var url: String = ""
  @Field var title: String = ""
  @Field var detail: String? = nil
  @Field var faviconUrl: String? = nil
  @Field var isSubscribed: Bool = false

  var feed: ComposerFeed {
    ComposerFeed(
      id: id, feedID: feedId, url: url, title: title, detail: detail,
      faviconURL: faviconUrl.flatMap(URL.init(string:)), isSubscribed: isSubscribed
    )
  }
}

struct ComposerFolderRecord: Record {
  @Field var id: String = ""
  @Field var name: String = ""

  var folder: ComposerFolder { ComposerFolder(id: id, name: name) }
}

struct ReaderToolRecord: Record {
  @Field var key: String = ""
  @Field var label: String = ""
  @Field var icon: IconRecord = IconRecord()
  @Field var selectedIcon: IconRecord? = nil
  @Field var selected: Bool = false
  @Field var selectedTint: UIColor? = nil
  @Field var disabled: Bool = false

  var tool: ReaderTool {
    ReaderTool(
      id: key, label: label, icon: icon.icon, selectedIcon: (selectedIcon ?? icon).icon,
      isSelected: selected, isEnabled: !disabled,
      selectedTint: selectedTint.map { Color(uiColor: $0) }
    )
  }
}

struct ReaderRecord: Record {
  @Field var tools: [ReaderToolRecord] = []
  @Field var fontSize: Double = 17
  @Field var minFontSize: Double = 14
  @Field var maxFontSize: Double = 22
  @Field var fontSizeLabel: String = "Text size"
  @Field var shareUrl: String? = nil

  var state: ReaderState {
    // A degenerate range would crash the slider; fall back to a single step above the minimum.
    let upper = max(maxFontSize, minFontSize + 1)
    return ReaderState(
      tools: tools.map(\.tool), fontSize: fontSize, fontRange: minFontSize...upper, fontLabel: fontSizeLabel,
      shareURL: shareUrl
    )
  }
}

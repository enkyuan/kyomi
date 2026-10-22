import ExpoModulesCore
import SwiftUI
import TabBar
import UIKit

// MARK: - Rows

enum ArticleRowKind: String {
  /// A feed article with its action toolbar.
  case article
  /// A recently viewed article, without actions.
  case recent
}

/// One list row, already formatted by JavaScript so native never owns copy or date logic.
struct ArticleRowModel: Equatable, Identifiable {
  let id: String
  let kind: ArticleRowKind
  let sourceLabel: String
  /// Relative publish time for articles, the "Viewed …" label for recents.
  let timeLabel: String
  let title: String
  let summary: String
  let faviconUrls: [URL]
  let feedTitle: String
  let isSaved: Bool
  /// The article was opened before, so it shows the "Continue reading" badge.
  let isContinuing: Bool
  /// The first row draws no divider above it. Set by the list, since it depends on position.
  var isFirst = false
}

struct ArticleRowRecord: Record {
  @Field var id: String = ""
  @Field var kind: String = "article"
  @Field var sourceLabel: String = ""
  @Field var timeLabel: String = ""
  @Field var title: String = ""
  @Field var summary: String = ""
  @Field var faviconUrls: [String] = []
  @Field var feedTitle: String = ""
  @Field var isSaved: Bool = false
  @Field var isContinuing: Bool = false

  var model: ArticleRowModel {
    ArticleRowModel(
      id: id,
      kind: ArticleRowKind(rawValue: kind) ?? .article,
      sourceLabel: sourceLabel,
      timeLabel: timeLabel,
      title: title,
      summary: summary,
      faviconUrls: faviconUrls.compactMap(URL.init(string:)),
      feedTitle: feedTitle,
      isSaved: isSaved,
      isContinuing: isContinuing
    )
  }
}

// MARK: - Style

/// A font resolved by JavaScript from the shared theme, so rows match the React Native screens.
struct ListFont {
  let family: String
  let size: CGFloat
  let lineHeight: CGFloat

  var font: Font {
    UIFont(name: family, size: size) != nil ? .custom(family, fixedSize: size) : .system(size: size)
  }

  /// Extra leading React Native adds around each line to reach `lineHeight`.
  var leading: CGFloat {
    let natural = (UIFont(name: family, size: size) ?? .systemFont(ofSize: size)).lineHeight
    return max(0, lineHeight - natural)
  }
}

struct FontRecord: Record {
  @Field var family: String = ""
  @Field var size: Double = 16
  @Field var lineHeight: Double = 20

  var font: ListFont {
    ListFont(family: family, size: CGFloat(size), lineHeight: CGFloat(lineHeight))
  }
}

struct ListIconRecord: Record {
  @Field var viewBox: String = "0 0 24 24"
  @Field var paths: [ListIconPathRecord] = []

  var icon: TabBarIcon {
    TabBarIcon(
      viewBox: viewBox,
      paths: paths.map { (d: $0.d, evenOdd: $0.fillRule == "evenodd", strokeWidth: $0.strokeWidth.map { CGFloat($0) }) }
    )
  }
}

struct ListIconPathRecord: Record {
  @Field var d: String = ""
  @Field var fillRule: String? = nil
  @Field var strokeWidth: Double? = nil
}

struct ListStyleRecord: Record {
  @Field var foreground: UIColor = .label
  @Field var mutedForeground: UIColor = .secondaryLabel
  @Field var border: UIColor = .separator
  @Field var secondary: UIColor = .secondarySystemFill
  @Field var card: UIColor = .secondarySystemBackground
  @Field var mutedIcon: UIColor = .secondaryLabel
  @Field var saved: UIColor = .systemBlue
  @Field var badgeBackground: UIColor = .clear
  @Field var badgeText: UIColor = .label
  @Field var metaFont: FontRecord = FontRecord()
  @Field var titleFont: FontRecord = FontRecord()
  @Field var summaryFont: FontRecord = FontRecord()
  @Field var badgeFont: FontRecord = FontRecord()
  @Field var badgeHeight: Double = 30
  @Field var summaryMaxLines: Int = 3
  @Field var actionIconSize: Double = 19
  @Field var bookmarkIcon: ListIconRecord = ListIconRecord()
  @Field var bookmarkFilledIcon: ListIconRecord = ListIconRecord()
  @Field var shareIcon: ListIconRecord = ListIconRecord()
  @Field var moreIcon: ListIconRecord = ListIconRecord()
  @Field var rssIcon: ListIconRecord = ListIconRecord()
  @Field var continueLabel: String = "Continue reading"
  @Field var emptySummary: String = "No summary available."
}

struct ArticleListStyle {
  var foreground: Color
  var mutedForeground: Color
  var border: Color
  var secondary: Color
  var card: Color
  var mutedIcon: Color
  var saved: Color
  var badgeBackground: Color
  var badgeText: Color
  var metaFont: ListFont
  var titleFont: ListFont
  var summaryFont: ListFont
  var badgeFont: ListFont
  var badgeHeight: CGFloat
  var summaryMaxLines: Int
  var actionIconSize: CGFloat
  var bookmarkIcon: TabBarIcon
  var bookmarkFilledIcon: TabBarIcon
  var shareIcon: TabBarIcon
  var moreIcon: TabBarIcon
  var rssIcon: TabBarIcon
  var continueLabel: String
  var emptySummary: String

  init(_ record: ListStyleRecord) {
    foreground = Color(uiColor: record.foreground)
    mutedForeground = Color(uiColor: record.mutedForeground)
    border = Color(uiColor: record.border)
    secondary = Color(uiColor: record.secondary)
    card = Color(uiColor: record.card)
    mutedIcon = Color(uiColor: record.mutedIcon)
    saved = Color(uiColor: record.saved)
    badgeBackground = Color(uiColor: record.badgeBackground)
    badgeText = Color(uiColor: record.badgeText)
    metaFont = record.metaFont.font
    titleFont = record.titleFont.font
    summaryFont = record.summaryFont.font
    badgeFont = record.badgeFont.font
    badgeHeight = CGFloat(record.badgeHeight)
    summaryMaxLines = record.summaryMaxLines
    actionIconSize = CGFloat(record.actionIconSize)
    bookmarkIcon = record.bookmarkIcon.icon
    bookmarkFilledIcon = record.bookmarkFilledIcon.icon
    shareIcon = record.shareIcon.icon
    moreIcon = record.moreIcon.icon
    rssIcon = record.rssIcon.icon
    continueLabel = record.continueLabel
    emptySummary = record.emptySummary
  }
}

// MARK: - Actions

enum ArticleRowAction: String {
  case toggleSaved
  case share
  case openSource
  case hide
  case report
}

/// Row callbacks, handed to SwiftUI without retaining the list view.
struct ArticleRowActions {
  let press: (String) -> Void
  let pressIn: (String) -> Void
  let perform: (String, ArticleRowAction) -> Void
}

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
struct ArticleRowModel: Equatable, Identifiable, Sendable {
  let id: String
  let kind: ArticleRowKind
  let sourceLabel: String
  /// Relative publish time for articles, the "Viewed …" label for recents.
  let timeLabel: String
  let title: String
  let summary: String
  let faviconUrls: [URL]
  let isSaved: Bool
  /// The article was started and left unfinished, so it shows the "Continue reading" badge.
  let isContinuing: Bool
  /// The badge text, the time left such as "6m left". `nil` shows the style's `continueLabel`.
  let continueLabel: String?
}

/// A row as JavaScript serialises it into a list operation (`ArticleListRow` in `types.ts`).
/// Decoded with `Decodable` on the worker queue; an Expo `Record` would reflect over every field of
/// every row on the main thread.
struct ArticleRowWire: Decodable {
  let id: String
  let kind: String
  let sourceLabel: String
  let timeLabel: String
  let title: String
  let summary: String?
  let faviconUrls: [String]
  let isSaved: Bool?
  let isContinuing: Bool?
  let continueLabel: String?

  var model: ArticleRowModel {
    ArticleRowModel(
      id: id,
      kind: ArticleRowKind(rawValue: kind) ?? .article,
      sourceLabel: sourceLabel,
      timeLabel: timeLabel,
      title: title,
      summary: summary ?? "",
      faviconUrls: faviconUrls.compactMap(URL.init(string:)),
      isSaved: isSaved ?? false,
      isContinuing: isContinuing ?? false,
      continueLabel: continueLabel
    )
  }
}

// MARK: - Style

/// A font resolved by JavaScript from the shared theme, so rows match the React Native screens.
/// Font lookup and leading are computed once; rows read them on every scroll-time layout.
struct ListFont {
  let font: Font
  /// Extra leading React Native adds around each line to reach `lineHeight`.
  let leading: CGFloat

  init(family: String, size: CGFloat, lineHeight: CGFloat) {
    let resolved = UIFont(name: family, size: size)
    font = resolved != nil ? .custom(family, size: size, relativeTo: .body) : .system(size: size)
    leading = max(0, lineHeight - (resolved ?? .systemFont(ofSize: size)).lineHeight)
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
  static let faviconSize: CGFloat = 22
  /// Favicons are squircles: the continuous corner radius scales with the icon, as in `FeedFavicon`.
  static let faviconCornerRatio: CGFloat = 0.25
  static let faviconPlaceholderSize: CGFloat = faviconSize * 0.6

  var foreground: Color
  var mutedForeground: Color
  var border: Color
  /// The list draws its separators itself, in this colour.
  var separatorColor: UIColor
  /// The loading footer's spinner.
  var loadingColor: UIColor
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
  /// Row glyphs, rasterized once per theme: every row shows them, and filling their vector
  /// outlines again for each row that scrolls in was the costliest part of building a row.
  var bookmarkIcon: UIImage
  var bookmarkFilledIcon: UIImage
  var shareIcon: UIImage
  var moreIcon: UIImage
  /// Favicon placeholder, drawn at `faviconPlaceholderSize`.
  var rssIcon: UIImage
  var continueLabel: String
  var emptySummary: String

  init(_ record: ListStyleRecord) {
    foreground = Color(uiColor: record.foreground)
    mutedForeground = Color(uiColor: record.mutedForeground)
    border = Color(uiColor: record.border)
    separatorColor = record.border
    loadingColor = record.mutedForeground
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
    let actionSize = actionIconSize
    bookmarkIcon = record.bookmarkIcon.icon.templateImage(size: actionSize)
    bookmarkFilledIcon = record.bookmarkFilledIcon.icon.templateImage(size: actionSize)
    shareIcon = record.shareIcon.icon.templateImage(size: actionSize)
    moreIcon = record.moreIcon.icon.templateImage(size: actionSize)
    rssIcon = record.rssIcon.icon.templateImage(size: Self.faviconPlaceholderSize)
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

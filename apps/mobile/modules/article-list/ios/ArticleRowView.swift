import SwiftUI
import TabBar
import UIKit

/// One list row. It mirrors the React Native `Item` and `RecentHistoryItem` layouts point for point:
/// 20pt side padding, the same gaps and the same type scale, all fed from the shared JS theme.
struct ArticleRowView: View {
  let row: ArticleRowModel
  let style: ArticleListStyle
  let actions: ArticleRowActions

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      switch row.kind {
      case .article: articleContent
      case .recent: recentContent
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .overlay(alignment: .top) {
      if !row.isFirst {
        Rectangle().fill(style.border).frame(height: 1)
      }
    }
  }

  // MARK: Article

  private var articleContent: some View {
    VStack(alignment: .leading, spacing: 0) {
      Button {
        actions.press(row.id)
      } label: {
        VStack(alignment: .leading, spacing: 0) {
          VStack(alignment: .leading, spacing: 16) {
            sourceRow(time: row.timeLabel)
            ListText(row.title, font: style.titleFont, color: style.foreground, lines: 2)
          }
          .padding(.top, 20)
          .padding(.bottom, 10)
          .padding(.horizontal, 20)

          ListText(
            row.summary.isEmpty ? style.emptySummary : row.summary,
            font: style.summaryFont,
            color: style.mutedForeground.opacity(0.95),
            lines: style.summaryMaxLines
          )
          .padding(.horizontal, 20)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
      }
      .buttonStyle(RowPressStyle(pressedOpacity: 1, onPressIn: { actions.pressIn(row.id) }))
      .accessibilityLabel(row.title)
      .accessibilityAddTraits(.isButton)

      HStack(spacing: 12) {
        if row.isContinuing {
          continueBadge
        }
        Spacer(minLength: 0)
        toolbar
      }
      .padding(.top, 12)
      .padding(.horizontal, 20)
      .padding(.bottom, 16)
    }
  }

  private var continueBadge: some View {
    Text(style.continueLabel)
      .font(style.badgeFont.font)
      .foregroundStyle(style.badgeText)
      .lineLimit(1)
      .padding(.horizontal, 8)
      .frame(height: style.badgeHeight)
      .background(Capsule().fill(style.badgeBackground))
      .accessibilityLabel("Previously opened. Continue reading.")
  }

  private var toolbar: some View {
    HStack(spacing: 4) {
      Button {
        actions.perform(row.id, .toggleSaved)
      } label: {
        actionIcon(
          row.isSaved ? style.bookmarkFilledIcon : style.bookmarkIcon,
          color: row.isSaved ? style.saved : style.mutedIcon
        )
      }
      .buttonStyle(ActionPressStyle(pressed: style.secondary))
      .accessibilityLabel(row.isSaved ? "Remove from read later" : "Read later")

      Button {
        actions.perform(row.id, .share)
      } label: {
        actionIcon(style.shareIcon, color: style.mutedIcon)
      }
      .buttonStyle(ActionPressStyle(pressed: style.secondary))
      .accessibilityLabel("Share article")

      Menu {
        Button {
          actions.perform(row.id, .openSource)
        } label: {
          Label("Open source", systemImage: "arrow.up.right")
        }
        Button(role: .destructive) {
          actions.perform(row.id, .hide)
        } label: {
          Label("Not interested", systemImage: "eye.slash")
        }
        Button {
          actions.perform(row.id, .report)
        } label: {
          Label("Report broken article", systemImage: "exclamationmark.bubble")
        }
      } label: {
        actionIcon(style.moreIcon, color: style.mutedIcon)
      }
      .menuIndicator(.hidden)
      .buttonStyle(.plain)
      .accessibilityLabel("More article actions")
    }
    .accessibilityElement(children: .contain)
  }

  private func actionIcon(_ icon: TabBarIcon, color: Color) -> some View {
    TabBarIconView(icon: icon, size: style.actionIconSize, color: color)
      .frame(width: 48, height: 48)
      .contentShape(Circle())
  }

  // MARK: Recent

  private var recentContent: some View {
    Button {
      actions.press(row.id)
    } label: {
      VStack(alignment: .leading, spacing: 12) {
        sourceRow(time: nil)
        ListText(row.title, font: style.titleFont, color: style.foreground, lines: 2)
        ListText(row.timeLabel, font: style.metaFont, color: style.mutedForeground.opacity(0.8), lines: 1)
      }
      .padding(.horizontal, 20)
      .padding(.vertical, 20)
      .frame(maxWidth: .infinity, alignment: .leading)
      .contentShape(Rectangle())
    }
    .buttonStyle(RowPressStyle(pressedOpacity: 0.7, onPressIn: { actions.pressIn(row.id) }))
    .accessibilityLabel("\(row.title). \(row.timeLabel)")
  }

  // MARK: Shared

  private func sourceRow(time: String?) -> some View {
    HStack(spacing: 16) {
      HStack(spacing: 12) {
        FaviconView(urls: row.faviconUrls, size: 22, placeholder: style.rssIcon, tint: style.mutedForeground, background: style.card)
          .accessibilityHidden(true)
        ListText(row.sourceLabel, font: style.metaFont, color: style.mutedForeground.opacity(0.95), lines: 1)
          .frame(maxWidth: .infinity, alignment: .leading)
      }
      if let time {
        ListText(time, font: style.metaFont, color: style.mutedForeground.opacity(0.8), lines: 1)
          .fixedSize()
      }
    }
  }
}

/// Text laid out like React Native: each line sits in a `lineHeight` box with the extra leading
/// split above and below, so first-line positions and total heights match.
struct ListText: View {
  let text: String
  let font: ListFont
  let color: Color
  let lines: Int

  init(_ text: String, font: ListFont, color: Color, lines: Int) {
    self.text = text
    self.font = font
    self.color = color
    self.lines = lines
  }

  var body: some View {
    Text(text)
      .font(font.font)
      .foregroundStyle(color)
      .lineSpacing(font.leading)
      .lineLimit(lines)
      .multilineTextAlignment(.leading)
      .fixedSize(horizontal: false, vertical: true)
      .padding(.vertical, font.leading / 2)
  }
}

/// Reports the touch-down, which React Native's `onPressIn` used to prefetch the reader payload.
struct RowPressStyle: ButtonStyle {
  let pressedOpacity: Double
  let onPressIn: () -> Void

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .opacity(configuration.isPressed ? pressedOpacity : 1)
      .onChange(of: configuration.isPressed) { _, pressed in
        if pressed { onPressIn() }
      }
  }
}

/// The 48pt round action buttons fill with the secondary surface while pressed.
struct ActionPressStyle: ButtonStyle {
  let pressed: Color

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .background(Circle().fill(configuration.isPressed ? pressed : .clear))
  }
}

/// A feed favicon that walks its candidate URLs until one loads, over the rounded card placeholder.
struct FaviconView: View {
  let urls: [URL]
  let size: CGFloat
  let placeholder: TabBarIcon
  let tint: Color
  let background: Color

  @State private var image: UIImage?

  init(urls: [URL], size: CGFloat, placeholder: TabBarIcon, tint: Color, background: Color) {
    self.urls = urls
    self.size = size
    self.placeholder = placeholder
    self.tint = tint
    self.background = background
    _image = State(initialValue: urls.lazy.compactMap { FaviconStore.cachedImage(for: $0) }.first)
  }

  var body: some View {
    ZStack {
      if let image {
        Image(uiImage: image).resizable().scaledToFit()
      } else {
        TabBarIconView(icon: placeholder, size: size * 0.6, color: tint)
      }
    }
    .frame(width: size, height: size)
    .background(background.opacity(0.85))
    .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
    .task(id: urls) {
      guard image == nil else { return }
      for url in urls {
        if let loaded = await FaviconStore.shared.image(for: url) {
          image = loaded
          return
        }
      }
    }
  }
}

/// `NSCache` is thread-safe, so the cache is read without hopping to the main actor; that lets a
/// favicon that is already loaded draw on its first frame instead of flashing the placeholder.
private nonisolated(unsafe) let faviconCache: NSCache<NSURL, UIImage> = {
  let cache = NSCache<NSURL, UIImage>()
  cache.countLimit = 400
  return cache
}()

@MainActor
final class FaviconStore {
  static let shared = FaviconStore()

  private var failed = Set<URL>()

  nonisolated static func cachedImage(for url: URL) -> UIImage? {
    faviconCache.object(forKey: url as NSURL)
  }

  func image(for url: URL) async -> UIImage? {
    if let cached = Self.cachedImage(for: url) { return cached }
    if failed.contains(url) { return nil }
    guard
      let (data, response) = try? await URLSession.shared.data(from: url),
      (response as? HTTPURLResponse).map({ (200..<300).contains($0.statusCode) }) ?? true,
      let image = UIImage(data: data)
    else {
      failed.insert(url)
      return nil
    }
    faviconCache.setObject(image, forKey: url as NSURL)
    return image
  }
}

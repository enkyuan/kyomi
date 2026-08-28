import SwiftUI

enum Metrics {
  static let horizontalPadding: CGFloat = 16
  static let gap: CGFloat = 10
  static let contentPadding: CGFloat = 4
  static let selectorRatio: CGFloat = 0.6
  static let normalBarHeight: CGFloat = 48
  static let compactBarHeight: CGFloat = 44
  static let normalMainWidth: CGFloat = 168
  static let compactMainWidth: CGFloat = 150
  static let tabIconSize: CGFloat = 25
  static let selectorIconScale: CGFloat = 0.8
  static let minimumTargetSize: CGFloat = 44
  static let searchIconSize: CGFloat = 18
  static let closeIconSize: CGFloat = 16
  static let selectionInset: CGFloat = 3
  static let matcha = Color(
    red: 168.0 / 255.0,
    green: 212.0 / 255.0,
    blue: 128.0 / 255.0
  )

  static var selectorIconSize: CGFloat {
    tabIconSize * selectorIconScale
  }
}

struct Layout {
  let horizontalPadding = Metrics.horizontalPadding
  let gap = Metrics.gap
  let contentPadding = Metrics.contentPadding
  let actionDiameter: CGFloat
  let barHeight: CGFloat
  let regularWidth: CGFloat
  let selectorWidth: CGFloat
  let mainWidth: CGFloat
  let scale: CGFloat
  let selectionWidth: CGFloat
  let selectionHeight: CGFloat
  let tabIconSize: CGFloat
  let selectorIconSize: CGFloat
  let searchIconSize: CGFloat
  let closeIconSize: CGFloat

  init(width: CGFloat, minimized: Bool) {
    actionDiameter = minimized ? Metrics.compactBarHeight : Metrics.normalBarHeight
    barHeight = minimized ? Metrics.compactBarHeight : Metrics.normalBarHeight
    scale = barHeight / Metrics.normalBarHeight
    tabIconSize = Metrics.tabIconSize * scale
    selectorIconSize = Metrics.selectorIconSize * scale
    searchIconSize = Metrics.searchIconSize * scale
    closeIconSize = Metrics.closeIconSize * scale

    let availableWidth = max(0, width - (horizontalPadding * 2))
    let maximumMainWidth = max(0, availableWidth - gap - actionDiameter)
    let preferredMainWidth = minimized ? Metrics.compactMainWidth : Metrics.normalMainWidth
    mainWidth = min(preferredMainWidth, maximumMainWidth)

    let usableWidth = max(0, mainWidth - (contentPadding * 2))
    regularWidth = usableWidth / (2 + Metrics.selectorRatio)
    selectorWidth = regularWidth * Metrics.selectorRatio
    selectionWidth = max(
      0,
      regularWidth + (2 * (contentPadding - Metrics.selectionInset))
    )
    selectionHeight = max(0, barHeight - (Metrics.selectionInset * 2))
  }

  func selectionX(for tab: String) -> CGFloat {
    let tabCenter = contentPadding + (regularWidth * (tab == "explore" ? 1.5 : 0.5))
    return tabCenter - (selectionWidth / 2)
  }
}

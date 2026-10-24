import SwiftUI

/// The bar's empty state: a title larger than the system's `ContentUnavailableView` draws, over a
/// smaller description, with no icon.
struct TabBarEmptyState: View {
  let title: String
  var description: String?
  @ScaledMetric(relativeTo: .title2) private var titleSize: CGFloat = 24

  var body: some View {
    VStack(spacing: 6) {
      Text(title)
        .font(.system(size: titleSize, weight: .semibold))
        .foregroundStyle(.primary)
      if let description {
        Text(description)
          .font(.footnote)
          .foregroundStyle(.secondary)
      }
    }
    .multilineTextAlignment(.center)
    .padding(.horizontal, TabBarMetrics.edgeInset)
    .accessibilityElement(children: .combine)
  }
}

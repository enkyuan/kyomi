import ExpoModulesCore
import SwiftUI

private final class HeaderModel: ObservableObject {
  @Published var title = ""
  @Published var collapseProgress = 0.0
  @Published var topInset = 0.0
}

private struct HeaderContent: View {
  @ObservedObject var model: HeaderModel

  private var progress: Double {
    min(max(model.collapseProgress, 0), 1)
  }

  private var compactTitleOpacity: Double {
    min(max((progress - 0.55) / 0.45, 0), 1)
  }

  private var largeTitleOpacity: Double {
    1 - min(max(progress / 0.55, 0), 1)
  }

  var body: some View {
    let compactHeight = model.topInset + 44
    let largeTitleY = model.topInset + 38

    ZStack(alignment: .topLeading) {
      Rectangle()
        .fill(.ultraThinMaterial)
        .opacity(progress)
        .frame(height: compactHeight)

      Text(model.title)
        .font(.system(size: 17, weight: .semibold))
        .lineLimit(1)
        .opacity(compactTitleOpacity)
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.top, model.topInset + 11)

      Text(model.title)
        .font(.system(size: 34, weight: .bold))
        .lineLimit(1)
        .opacity(largeTitleOpacity)
        .padding(.leading, 20)
        .padding(.top, largeTitleY)
    }
    .foregroundStyle(.primary)
    .accessibilityElement(children: .combine)
  }
}

final class HeaderView: ExpoView {
  private let model = HeaderModel()
  private var hostingController: UIHostingController<HeaderContent>!

  var title: String {
    get { model.title }
    set { model.title = newValue }
  }

  var collapseProgress: Double {
    get { model.collapseProgress }
    set { model.collapseProgress = newValue }
  }

  var topInset: Double {
    get { model.topInset }
    set { model.topInset = newValue }
  }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    hostingController = UIHostingController(rootView: HeaderContent(model: model))
    backgroundColor = .clear
    isOpaque = false

    let hostedView = hostingController.view!
    hostedView.backgroundColor = .clear
    hostedView.translatesAutoresizingMaskIntoConstraints = false
    addSubview(hostedView)

    NSLayoutConstraint.activate([
      hostedView.leadingAnchor.constraint(equalTo: leadingAnchor),
      hostedView.trailingAnchor.constraint(equalTo: trailingAnchor),
      hostedView.topAnchor.constraint(equalTo: topAnchor),
      hostedView.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])
  }
}

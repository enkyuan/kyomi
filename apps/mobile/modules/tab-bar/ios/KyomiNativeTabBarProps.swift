import ExpoModulesCore
import ExpoUI

struct KyomiSource: Record {
  @Field var id: String = ""
  @Field var title: String = ""
  @Field var kind: String = "feed"
  @Field var iconUrl: String?
  @Field var unreadCount: Int?
}

public final class KyomiTabBarProps: UIBaseViewProps {
  @Field var activeTab: String = "feeds"
  @Field var sources: [KyomiSource] = []
  @Field var selectedSourceId: String?
  @Field var minimized: Bool = false
  @Field var searchActive: Bool = false

  var onSelectTab = EventDispatcher()
  var onSelectSource = EventDispatcher()
  var onSearchPress = EventDispatcher()
  var onSearchQueryChange = EventDispatcher()
  var onSearchSubmit = EventDispatcher()
  var onSearchClose = EventDispatcher()
}

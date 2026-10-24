Pod::Spec.new do |s|
  s.name           = 'ArticleList'
  s.version        = '1.0.0'
  s.summary        = 'Kyomi native article list'
  s.description    = 'UICollectionView-backed list with SwiftUI rows for the Kyomi iOS app'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '26.0'
  }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '6.0'

  s.dependency 'ExpoModulesCore'
  # Draws the Blode action icons with the tab bar's path renderer.
  s.dependency 'TabBar'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end

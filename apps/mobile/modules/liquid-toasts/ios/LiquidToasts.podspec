Pod::Spec.new do |s|
  s.name           = 'LiquidToasts'
  s.version        = '1.0.0'
  s.summary        = 'Natively-rendered toasts on an overlay above the app.'
  s.description    = 'SwiftUI toast overlay with adaptive Liquid Glass, springy entrance, and per-position stacking.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '17.0'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end

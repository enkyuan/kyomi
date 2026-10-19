Pod::Spec.new do |s|
  s.name           = 'TabBar'
  s.version        = '1.0.0'
  s.summary        = 'Kyomi floating tab bar'
  s.description    = 'SwiftUI Liquid Glass tab bar for the Kyomi iOS app'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '26.0'
  }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '6.0'

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end

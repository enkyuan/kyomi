Pod::Spec.new do |s|
  s.name           = 'ScreenShape'
  s.version        = '1.0.0'
  s.summary        = 'Display corner geometry for Kyomi native chrome.'
  s.description    = 'Reports resolved lower display-corner radii to align floating controls.'
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

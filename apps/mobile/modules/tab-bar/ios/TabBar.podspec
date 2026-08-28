Pod::Spec.new do |s|
  s.name = 'TabBar'
  s.version = '1.0.0'
  s.summary = 'Kyomi native floating tab bar'
  s.description = 'Native floating tab bar for Kyomi mobile.'
  s.homepage = 'https://github.com/kyomi/kyomi'
  s.license = { :type => 'MIT' }
  s.author = { 'Kyomi' => 'hello@kyomi.app' }
  s.platforms = { :ios => '17.0' }
  s.source = { git: 'https://github.com/kyomi/kyomi.git', tag: s.version.to_s }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'ExpoUI'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end

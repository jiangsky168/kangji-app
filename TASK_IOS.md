# iOS 工程构建任务书（Codex）

## 目标
完成康福 iOS 工程（Capacitor 6）的模拟器无签名编译验证，产出可签名出包的工程状态。

## 现状（已完成的）
- Xcode 26.6 已装，iOS 26.5 Simulator 平台已下载安装（8.5GB，done）
- Capacitor 6.2.1 工程：/Users/bon/慢病管理App/apk/ios/App/App.xcodeproj
- 应用名"康福"已配置（Info.plist CFBundleDisplayName），1024px 图标已生成
- CocoaPods 1.17.0 已装（brew）
- **阻塞点**：`pod install` 失败——`Couldn't determine repo type for URL: https://cdn.cocoapods.org/: Net::OpenTimeout`（CDN 被墙超时）
- Pods/ 目录已部分生成（Headers/Local Podspecs/Target Support Files）

## 任务
1. 解决 pod install 的 CDN 超时，两种方向（可组合）：
   a. 代理：pod install 时设置 http_proxy=https_proxy=ALL_PROXY=http://127.0.0.1:7897（Ruby Net::HTTP 读小写环境变量；如不生效可用 ~/.netrc 或 Podfile 配置）
   b. 国内镜像：切换 CocoaPods 源为清华 TUNA 镜像（https://mirrors.tuna.tsinghua.edu.cn/git/CocoaPods/Specs.git）或阿里云镜像（需验证可用性），注意 CDN trunk 方式（https://cdn.cocoapods.org/）是默认 source，可通过 Podfile source 或 pod repo 配置替换
2. pod install 成功（Podfile.lock + Pods/ 完整生成）
3. 验证编译：
   cd /Users/bon/慢病管理App/apk/ios/App && xcodebuild -project App.xcodeproj -scheme App -destination 'generic/platform=iOS Simulator' -configuration Debug build CODE_SIGNING_ALLOWED=NO
4. 若 Capacitor 6 模板与 Xcode 26 有其他兼容问题（如 SUPPORTED_PLATFORMS），先尝试最小改动修复（如 pbxproj 添加 SUPPORTED_PLATFORMS="iphoneos iphonesimulator"），不要升级 Capacitor 大版本（会破坏安卓侧）

## 输出
- pod install 结果（用方案a还是b、耗时）
- 编译结果（BUILD SUCCEEDED/FAILED + 错误摘要）
- 产物路径（DerivedData 中 .app 或 build 目录）
- 遗留问题清单

## 约束
- 不要修改 /Users/bon/慢病管理App/ 下的原型文件（index.html 等只读）
- 网络一律走代理（127.0.0.1:7897），环境变量在命令内显式设置

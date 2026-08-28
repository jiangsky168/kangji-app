# 康福项目全面复查任务书（Codex 第四轮）

## 项目
/Users/bon/慢病管理App/ — "康福"代谢健康档案 App（四高+脂肪肝患者端），单文件 HTML 原型 + PWA + 安卓 APK + iOS 工程。

## 检查范围（只审查，禁止修改任何文件）
1. **原型主文件** index.html（= 慢病管理App原型.html，SHA-1 应一致）：
   - JS 逻辑（导航 go()/back()/switchTab()、新用户引导4步、OCR流程、饮食拍照、历次报告对比、切换用户 switch-mini、数据隔离 demo/new 模式）
   - HTML 结构（无未闭合标签/重复id/非法嵌套）
   - CSS（对比度 WCAG AA、窄屏布局、中老年可读性、动画克制）
   - 可访问性（role/tabindex/keydown、aria-live、44px触控）
   - 安全（innerHTML/XSS转义、localStorage 校验）
   - 文案一致性（品牌"康福"无"康迹"残留、诚实化声明）
2. **测试** scripts/qa-test.js：运行 node scripts/qa-test.js 确认 98 项全过；检查测试覆盖是否遗漏近三轮修复（diet-snack位置/aria-pressed重置/餐数精确断言）
3. **PWA**：manifest.json、sw.js（缓存列表是否含 maskable 图标）、pwa/ 图标（192/512/maskable 安全区/apple-touch-icon 180）
4. **APK 相关**：kangfu.apk、康福原型.apk 存在；apk/android 工程可构建性（只静态检查，不必重构建）；.gitignore 是否遗漏
5. **iOS 工程**（新，重点）：apk/ios/App — AppDelegate/Info.plist（CFBundleDisplayName=康福、Bundle ID com.kangfu.health）、Assets.xcassets 图标（1024 AppIcon）、Podfile.lock 与 Pods 一致性、Capacitor 6.2.1 与 Xcode 26 兼容性、www 资源完整性（index.html/manifest/sw.js/pwa）
6. **文档一致性**：README.md（链接/APK下载/Release v0.1）、TECHDOC.md、功能清单草案 V3
7. **git 状态**：git status 干净性、gh-pages 分支与 main 内容一致性（gh-pages 应含 index.html/download.html/kangfu.apk/.nojekyll/pwa）

## 输出要求
- 按 严重/中等/轻微 分级，每项带文件路径+行号+证据
- 1-10 评分 + Top5 优先修复清单
- 明确结论：是否达到"可信演示版"标准（上轮终审 8/10 达标）
- 禁止修改任何文件，禁止运行 npm install / gradle 等重型操作

## 环境
- 代理 http://127.0.0.1:7897（如需网络）
- Node 22 / Python 3.9 / Xcode 26.6 已装

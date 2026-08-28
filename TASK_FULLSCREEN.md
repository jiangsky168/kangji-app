# 康福 App 移动端全屏适配修复任务书

## 背景（Codex 视觉分析结论）
原型 HTML 是为桌面浏览器演示设计的：body 居中布局+渐变背景，中间放 `.phone` 手机模型容器（width:390px;height:844px;border:10px solid;border-radius:44px），内有模拟 `.statusbar`（固定 9:41）。打包进 Capacitor App 后原样显示，iPhone 真机上出现"框中框"：内容缩在手机模型里、四周 body 渐变空白、双层状态栏、底部导航压内容、三列指标卡过窄、"上传化验单后显示"换行破碎、右上角头像 SVG 缺失（.icon-btn svg 无尺寸）。

## 修复要求（修改 /Users/bon/慢病管理App/index.html）

### 1. App 模式全屏适配（核心）
- JS 启动时检测：`window.Capacitor && window.Capacitor.isNativePlatform()` 或 userAgent 含 'Capacitor' → 给 `<html>` 或 `<body>` 加 class `app-mode`
- CSS 增加 `.app-mode` 规则：
  - `body`：取消居中布局副作用（保持渐变背景但铺满），去除不必要的 margin/padding
  - `.phone`：`width:100vw; height:100dvh; border:none; border-radius:0; max-height:none; box-shadow:none`
  - `.statusbar`：`display:none`
  - 页面内容容器：适配安全区 `padding-top: env(safe-area-inset-top)`；底部导航栏 `padding-bottom: env(safe-area-inset-bottom)`
  - 底部 Tab 栏在 .app-mode 下改为 fixed 定位贴底（或保持 absolute 但确保不遮内容：内容容器 padding-bottom 增大到 78px + safe-area）
- **桌面浏览器（无 Capacitor）保持现有 .phone 演示样式完全不变**

### 2. 指标卡三列断点
- 现有 `@media (max-width:360px){.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}`
- 改为 480px 断点（或 .app-mode 下强制两列），消除 370px 内容宽下"示"字单独成行问题

### 3. 头像/图标 SVG 尺寸
- `.icon-btn svg` 补明确 width/height（如 22px），确保右上角个人中心图标显示

### 4. 验证
- `node scripts/qa-test.js` 必须 98/98 通过（若 .app-mode 影响 jsdom 环境，注意 jsdom 无 Capacitor → 默认桌面模式，测试应不受影响）
- grep 确认零 em-dash
- 同步：修改后把 index.html 复制到 apk/www/index.html（部署副本）
- 单独 commit 提交推送：`fix(app): 移动端全屏适配（隐藏手机模型框/模拟状态栏，safe-area适配）`

## 红线
- 桌面演示模式（.phone 框）必须保持原样
- 不改变现有功能行为/Tab 结构/CSS 变量
- 完成后报告：改动文件清单、测试结果、commit

## 环境
- 项目：/Users/bon/慢病管理App/
- Node 22，jsdom 在 ~/.hermes/hermes-agent/node_modules

# 康福 App 功能扩展任务书：化验单相册选图

## 需求
拍照上传化验单流程（#screen-scan 的 #scan-step1 取景页）中，在"拍照识别"按钮旁/下方增加**"从相册选择"**入口，用户可从手机相册选择已拍的化验单图片，走与拍照相同的 OCR 模拟流程（OCR 动画 → 指标确认页 #scan-step2 → 归档）。

## 实现要求（修改 /Users/bon/慢病管理App/index.html）

### 1. UI 入口（scan-step1）
- "拍照识别"按钮（line 1967 附近，onclick="doScan()"）下方加一个次级按钮：
  - 样式：outline/次级样式（复用 .btn-secondary 或类似，无则新建 .btn-ghost 类），teal 边框浅底、16px 大字、min-height:44px、全宽
  - 文案："从相册选择"（配一个相册/图片 icon，svg 宽 20px）
  - onclick：`document.getElementById('scan-file').click()`
- 页面内加隐藏输入：`<input type="file" id="scan-file" accept="image/*" style="display:none">`
- 按钮间距 margin-top:10px；两个按钮之间用"或"分隔文案（小字，如"或"）

### 2. 相册选图逻辑
- `scan-file` change 事件：无文件直接 return；有文件时：
  - 取景页显示已选状态：在按钮区上方插入/更新一行提示"已选择图片：<文件名>"，字号 12.5px，色 var(--teal-700)
  - 调用 doScan() 进入 OCR 模拟（与拍照完全一致：ocr-state 动画、scanToken 防重、2200ms 后进 step2）
  - 若用户换选图片（再次 change），文件名更新即可
- 拍照路径（doScan 原有调用）行为完全不变

### 3. 兼容性
- 桌面浏览器：file input 原生打开文件选择器，行为一致（演示可用）
- Capacitor App：iOS 会拉起系统相册（PHPicker）
- resetScan() 重拍时应清掉"已选择图片"提示行（重新显示取景提示）

### 4. 测试（scripts/qa-test.js）
- 新增"相册选图"用例（放在 OCR 测试节后）：
  - 进入 startScan() → 断言"从相册选择"按钮存在
  - 模拟 change：`var input=doc.getElementById('scan-file'); Object.defineProperty(input,'files',{value:[new win.File(['x'],'report.jpg',{type:'image/jpeg'})]}); input.dispatchEvent(new win.Event('change',{bubbles:true}));`
  - 断言：OCR 状态可见（ocr-state）、2200ms 后 scan-step2 可见、已选提示含文件名
  - resetScan() 后提示被清除
- 原 98 项必须全部保持通过

### 5. 收尾
- 零 em-dash
- `cp index.html apk/www/index.html` 同步部署副本
- 单独 commit：`feat(scan): 化验单支持从相册选择图片`
- 推送 main

## 红线
- 不改变拍照路径、不改变 OCR 确认页逻辑、不改 CSS 变量体系
- 完成后报告：改动位置、测试结果（应为 98+N 通过）、commit

## 环境
- 项目 /Users/bon/慢病管理App/；Node 22；jsdom 在 ~/.hermes/hermes-agent/node_modules；代理 http://127.0.0.1:7897

# 康福 App 功能扩展任务书：相册多选化验单

## 需求
化验单"从相册选择"支持一次选多张图片（multiple），选完后**逐张走 OCR 确认流程**：第 1 张 OCR 动画 → 指标确认页 → 归档 → 自动开始第 2 张 → …… 全部处理完提示"已归档 N 张报告"并回首页。

## 实现要求（修改 /Users/bon/慢病管理App/index.html + scripts/qa-test.js）

### 1. 相册多选
- `#scan-file` input 加 `multiple` 属性
- change 处理：读取 `input.files` 全部存入全局 `scanFiles`（FileList 转数组），`scanIdx = 0`，显示"已选择 N 张图片"提示（scan-file-status），调用 doScan() 处理第一张

### 2. 逐张处理流程（核心）
- doScan() OCR 动画期间：`ocr-state` 的标题文字显示进度，如"正在识别报告内容（第 2/5 张）"（单张时保持原文字不变，避免破坏现有测试断言）
- saveScan()（确认归档）后逻辑：
  - 若 `scanIdx < scanFiles.length - 1`：`scanIdx++`，显示"第 N 张已归档，继续第 N+1 张"（toast 或提示行），自动重新进入 OCR 动画处理下一张（复用 doScan 的 token 机制，注意定时器链）
  - 若已全部处理完：toast "已归档 N 张报告"，按现有行为回首页
- 单张相册选图（files.length===1）的行为与现在完全一致（不显示进度、归档后直接回首页）

### 3. 边界
- resetScan()：清空 scanFiles/scanIdx，恢复取景页
- 用户在确认页点"取消"（back）：清空整个多选队列（与现有取消行为一致）
- 用户中途切换页面（cancelFlows 场景）：token 失效即可，下次进入流程重新开始
- 相册未选任何文件（取消选择）：无 change 或 files 为空，不报错

### 4. 测试（scripts/qa-test.js）
- 新增用例：
  - 模拟 change 带 2 个 File → 断言提示"已选择 2 张图片"
  - 第一张 OCR 后进确认页（现有断言兼容：标题不含进度文字或含"第 1/2 张"）
  - saveScan 归档后 → 自动进入第二张 OCR → 确认页 → saveScan → 断言 toast 含"已归档 2 张"且回到首页
  - resetScan 清空队列（重进流程 files 归零）
- 原 103 项全部保持通过（若单张断言受影响，按"单张行为不变"原则微调并说明）

### 5. 收尾
- 零 em-dash
- `cp index.html 慢病管理App原型.html` 与 `cp index.html apk/www/index.html` 双同步
- `cd apk && npx cap sync ios`（**必须执行**，iOS 工程读 ios/App/App/public/，上次漏了导致手机不更新）
- 单独 commit：`feat(scan): 相册支持多选，逐张OCR归档`
- 推送 main

## 红线
- 单张相册/拍照路径行为不变
- 不改变确认页表单结构
- 完成后报告：改动点、测试结果（103+N）、commit、public 目录已确认同步

## 环境
- 项目 /Users/bon/慢病管理App/；Node 22；jsdom 在 ~/.hermes/hermes-agent/node_modules；代理 http://127.0.0.1:7897

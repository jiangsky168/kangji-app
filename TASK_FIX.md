# 康福项目修复任务书（Codex 执行，第四轮复查发现）

## 目标
修复第四轮复查（TASK_CHECK.md，评分 7/10）发现的 5 中等 + 1 轻微问题。每项独立 commit，全部完成后跑通 98 项回归测试并推送。

## 修复项（按序执行）

### 1. 重建 gh-pages 分支（公开下载链路）
- 现状：gh-pages 分支 3,249 文件/53.8MB，含 1,668 个 node_modules、607 个 Android 构建文件、475 个失败工程文件、12 个日志
- 目标：重建为最小静态发布集，仅含：index.html、download.html、kangfu.apk、.nojekyll、manifest.json、sw.js、pwa/（7个文件+目录）
- 方式：git checkout --orphan 重建 gh-pages，只 add 上述文件，force push
- 完成后切回 main，验证 gh-pages 文件数与体积

### 2. 新用户/演示数据彻底隔离
- 现状：applyUserMode({mode:'new'}) 只清首页指标，饮食页仍显示演示用户早餐/午餐/加餐（"已记录3餐"）、档案/家庭/对比页仍共享演示 DOM
- 目标：mode==='new' 时：
  - 饮食页：三张/四张餐卡清空为未记录状态（data-recorded="0"、去掉照片背景、恢复默认文案）、餐数统计归零、"本周饮食统计"重置
  - 档案/指标/对比/家庭等页：指标区域与演示标记一致的空态（参考首页空态样式：-- 暂无数据）
  - 切回 demo 时恢复演示数据（保留演示 DOM，用 display/class 控制，不要删节点）
- 注意：不可破坏 switch-mini 切换用户流程与 98 项测试

### 3. 可访问性 + 中老年易用性
- 触控目标 ≥44px：.card-title .more（22.5px）、.check（28×28）、.seg button（32.5px 高）、.diet-chip（38px 高）、.switch-mini、.ce-btn 等所有可点击元素——用 padding/尺寸补足 44×44 或 44px 高度，视觉可保持紧凑（用透明 padding 或 ::after 扩展热区，避免破坏现有布局）
- 6 个输入框补关联 label：OCR 确认页"医院"、"日期"（index.html:1938 附近）+ 建档 4 字段（手机号/姓名/出生年/身高，index.html:1979 附近）——用 aria-label 或 label for（jsdom 测试注意）
- 对比度：.ai-interpret 的 .ai-note（≈3.66:1）、.member-hero p（≈4.24:1）提至 ≥4.5:1（改颜色值，如 rgba(255,255,255,.72)→.85 或深色底上浅色文本）
- 320px 窄屏：.metric-grid 三列 → 媒体查询 ≤360px 时两列，消除 73px 宽碎片化换行

### 4. iOS 工程入库 + .gitignore
- 提交 apk/ios/、apk/www/、apk/package.json、apk/package-lock.json 的修改
- .gitignore 追加：Pods/、DerivedData/、xcuserdata/、*.xcuserstate、ios/App/Pods/
- 注意：apk/android-capacitor8-failed/ 等失败实验目录应排除（确认已 ignore）

### 5. 文档同步
- README.md：测试数 71→98、页面 18→19、增加 Release v0.1 直链（https://github.com/jiangsky168/kangji-app/releases/tag/v0.1）、部署状态更新（gh-pages 源 + Pages 异常说明）
- TECHDOC.md：8.5 节部署现状更新为真实状态（当前 Pages errored/Actions queued、gh-pages 分支源、Release 兜底）
- 功能清单草案.md 如有页面数描述一并同步

### 6. localStorage 校验加强（轻微）
- 启动检测：姓名 trim 后 1-20 字符、conditions 数组 ≤5 项且每项 ∈ 已知病种白名单（高血压/糖尿病/血脂异常/高尿酸/脂肪肝）、gender ∈ {男,女}、year 为 1920-2016 整数、height 为 120-220 整数
- 不符合即视为损坏存档，清除进引导

## 红线
- 零 em-dash（破折号字符禁止）
- 不改变现有功能行为、Tab 结构、CSS 变量体系
- 每项独立 git commit，提交信息中文（如 "fix(隔离): 新用户模式清空饮食演示数据"）
- 全部完成后：node scripts/qa-test.js 必须 98/98 通过；若修复改变行为导致旧断言失败，更新断言并说明原因
- 完成后 git push origin main + gh-pages force push
- 结束后报告：每项修复内容、测试结果、git log 提交列表

## 环境
- 代理 http://127.0.0.1:7897（git push 需）
- Node 22 / jsdom 在 ~/.hermes/hermes-agent/node_modules

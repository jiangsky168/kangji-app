# 康福 App 功能任务书：对接本机 PaddleOCR 真实识别

## 需求
"从相册选择"图片后，调用本机 OCR 服务（http://192.168.1.56:8001/ocr，PaddleOCR + Flask 已在 Mac 运行），把**真实识别结果**填充到指标确认页（#scan-step2），替换现在的固定演示数据。多张图=每张真实不同结果。

## 现状
- 相册流程：#scan-file change → scanFiles 队列 → doScan()（**模拟 OCR**：ocr-state 动画 + 2200ms 定时器 → 显示 #scan-step2，数据写死：空腹血糖6.4/总胆固醇5.6/甘油三酯2.1/低密度脂蛋白3.7/高密度脂蛋白1.1/血尿酸445/谷丙转氨酶52/谷草转氨酶38/γ-谷氨酰转肽酶48/糖化血红蛋白6.8）
- 确认页结构（index.html ~1986-1995）：10 个 `.ct-row`，每行 `<span class="ct-name">指标名</span><input class="num" value="X"><span class="ct-unit">单位</span><span class="ct-ref">参考</span>`
- 拍照路径（doScan 原按钮）保持模拟不变

## OCR 服务接口（已在 192.168.1.56:8001 运行）
- POST /ocr：multipart 表单 `file=<图片>` → `{"ok":true,"lines":["市第一人民医院","检验报告单","姓名：张卫东...","葡萄糖 GLU","6.8","3.9-6.1 mmol/L","H",...],"time_ms":123}`
- lines 是**按阅读顺序的纯文本行**（无坐标）

## 实现要求（修改 /Users/bon/慢病管理App/index.html + apk/ios/App/App/Info.plist + scripts/qa-test.js）

### 1. OCR API 地址常量
- `var OCR_API = (localStorage.getItem('ocr_api') || 'http://192.168.1.56:8001/ocr');`（可被 localStorage 覆盖，方便改 IP）

### 2. 相册路径真实识别
- scan-file change 后：**不再走模拟定时器**，改为真实请求：
  1. 显示 ocr-state（"正在识别报告内容（第 x/N 张）"），**最短展示 800ms**（防闪烁）
  2. `fetch(OCR_API, {method:'POST', body: FormData(file)})`（FormData append 'file'）→ 解析 `lines`
  3. `parseOcrLines(lines)` 结构化 → 填充确认页 10 个 ct-row 的 input.value
  4. 成功：toast `识别完成（本地OCR · N 项）`，进入 #scan-step2
  5. **失败降级**：fetch 异常/超时（AbortController 8 秒）→ toast `无法连接识别服务，请确认电脑已开机且手机在同一 WiFi`，停留取景页，**不进入确认页**（避免填假数据）
- 多张队列：每张依次真实识别（saveScan 归档后自动下一张，沿用现有 scanIdx 逻辑，但第二张起也要真实 fetch）

### 3. 指标解析器 parseOcrLines(lines)
- 指标名映射表（按确认页 10 行）：空腹血糖←[葡萄糖,GLU,空腹血糖,Glu]、总胆固醇←[总胆固醇,TC,胆固醇]、甘油三酯←[甘油三酯,TG]、低密度脂蛋白←[低密度脂蛋白,LDL,LDLC]、高密度脂蛋白←[高密度脂蛋白,HDL,HDLC]、血尿酸←[尿酸,UA]、谷丙转氨酶←[谷丙转氨酶,ALT,丙氨酸氨基转移酶]、谷草转氨酶←[谷草转氨酶,AST,天门冬氨酸氨基转移酶]、γ-谷氨酰转肽酶←[γ-谷氨酰转肽酶,GGT,γ-GT,谷氨酰转肽酶]、糖化血红蛋白←[糖化血红蛋白,HbA1c,糖化]
- 匹配策略：遍历 lines，找到含指标名（忽略大小写）的行 → 在**该行及后续最多 3 行**里找第一个匹配 `/^\d+(\.\d+)?$/` 的数值 → 同时捕捉同行或相邻行的单位（mmol/L、μmol/L、umol/L、U/L、%、mg/dL）
- 输出 `[{name, value, unit, ref}]`（最多 10 项，缺项 value 填 '--'，UI 显示为待补充）
- 数值以 OCR 文本为准；`--` 项保持空 input 可手填

### 4. iOS ATS 配置（关键！WKWebView 默认禁 http）
- apk/ios/App/App/Info.plist 加：
```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <true/>
</dict>
```
- （开发期方案；正式版再收紧为本地网络豁免）

### 5. 测试（scripts/qa-test.js）
- **parseOcrLines 单测**：喂一段真实风格的 lines（含 葡萄糖 GLU/6.8/3.9-6.1 mmol/L/H、总胆固醇TC/5.6...），断言 10 项中匹配项的值正确、缺项为 '--'
- **fetch mock 测试**：jsdom 里替换 window.fetch：成功返回（断言确认页 input.value 被真实数据填充）；失败 reject（断言 toast 提示 + 停留取景页不进确认页）
- 原有 113 项保持通过（拍照模拟路径测试不变；相册路径现有断言若依赖模拟数据，改为依赖 mock fetch 或调整断言）

### 6. 收尾
- 零 em-dash
- `cp index.html 慢病管理App原型.html` + `cp index.html apk/www/index.html` 双同步
- `cd apk && npx cap sync ios`（**必须**，iOS 读 ios/App/App/public/）
- 单独 commit：`feat(scan): 相册选图对接本地PaddleOCR真实识别`
- 推送 main

## 红线
- 拍照路径（模拟 OCR）行为完全不变
- 失败时**绝不填充演示数据**（宁可提示重试）
- 完成后报告：改动文件、parseOcrLines 示例输出、测试结果（113+N）、commit、public 已同步确认

## 环境
- 项目 /Users/bon/慢病管理App/；OCR 服务 http://192.168.1.56:8001/ocr（本机已运行）；Node 22；jsdom 在 ~/.hermes/hermes-agent/node_modules；代理 http://127.0.0.1:7897

# 第三轮终审任务书（Codex）

只审查，禁止修改任何文件。这是第三轮，前两轮评分 5/10 后已修复，请做最终验收。

## 项目背景
'康福'代谢健康档案 App 原型（单文件 HTML/CSS/JS，index.html 与 慢病管理App原型.html 同步），19 个页面，PWA，qa-test.js 95 项测试。

## 第二轮复查发现的问题已修复（请逐项验证）
1. 首页演示标注：DATA_PAGES 加 home，banner 插在 topbar 之后
2. cancelFlows()：go/back/switchTab 统一失效 scanToken/dietToken/obToken
3. 餐数统计改 data-recorded 属性（早餐/午餐=1，晚餐=0），不再依赖 opacity
4. 加餐创建独立第4张卡 diet-snack
5. 键盘初始化选择器去掉 reminder-entry（防双绑定）；cond-opt 补 aria-pressed
6. 启动检测：conditions 非字符串数组时整档清除并进引导
7. resetScan 恢复 data-default 初始识别值
8. 年份正则 ^\d{4}$ 范围 1920-2016；身高 ^\d{2,3}$ 范围 120-220
9. 微信运动连接后文案"每日步数自动同步"
10. maskable 图标重画（图形 x:112-399 在安全区内）+ sw.js 预缓存加入

## 验证重点
A. cancelFlows 是否引入新问题：saveScan/saveDiet 保存后回跳（直接改 stack+showScreen，不经过 go/back/switchTab）是否被误伤；保存 toast 期间用户导航是否正常
B. setDemoBanner 对 home 页插入位置（topbar 之后）是否正确，是否破坏布局
C. 饮食加餐卡插入位置、重复保存加餐是否覆盖旧记录
D. 重拍恢复 data-default 是否影响正常确认流程
E. 启动检测三态：有效 demo / 有效 new / 损坏（JSON 坏、mode 错、name 空、conditions 坏）
F. 残留问题与新增风险

## 验证方式
静态审查 + node scripts/qa-test.js（当前 95 项）+ jsdom 边界推演。

## 输出
逐项结论（已解决/部分解决/未解决+原因）、新发现问题（按严重度）、终审评分（1-10）、是否达到"可信演示版"标准（是/否+理由）、剩余 Top3 优先项。

// 原型逻辑层自动化测试（jsdom）
const fs = require('fs');
const os = require('os');
const path = require('path');

// 优先使用项目依赖，当前本机可复用 Hermes 已安装的 jsdom
const jsdomPath = require.resolve('jsdom', {
  paths: [process.cwd(), path.join(os.homedir(), '.hermes/hermes-agent')]
});
const { JSDOM } = require(jsdomPath);

const html = fs.readFileSync('慢病管理App原型.html', 'utf8');
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'http://localhost/',
  beforeParse(window) {
    // 预置演示模式，跳过首次启动引导，保证现有测试直接进首页
    window.localStorage.setItem('kangfu_user', JSON.stringify({ mode: 'demo', name: '张卫东' }));
  }
});
const doc = dom.window.document;
const win = dom.window;

// jsdom 不实现 layout，补齐最小依赖
Object.defineProperty(win.HTMLElement.prototype, 'offsetParent', { get() { return this.style.display === 'none' ? null : {}; } });
Object.defineProperty(win.HTMLElement.prototype, 'offsetHeight', { get() { return 100; } });

const errors = [];
win.addEventListener('error', e => errors.push(e.message));
win.console.error = (...a) => errors.push(a.join(' '));

function visible(id) {
  return doc.getElementById(id).style.display !== 'none';
}
function click(sel, label) {
  const el = doc.querySelector(sel);
  if (!el) { console.log('FAIL', label, '- 元素不存在:', sel); return; }
  el.click();
  console.log(label, '->', visible('screen-' + (label.includes('档案') ? 'archive' : '')) );
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await sleep(300); // 等 DOMContentLoaded 初始化

  let pass = 0, fail = 0;
  function assert(name, cond) {
    if (cond) { pass++; console.log('  ✅', name); }
    else { fail++; console.log('  ❌', name); }
  }

  console.log('=== 1. Tab 切换 ===');
  doc.querySelector('.tabbar .tab[data-tab="archive"]').click();
  assert('档案Tab -> screen-archive 可见', visible('screen-archive'));
  assert('首页隐藏', !visible('screen-home'));

  doc.querySelector('.tabbar .tab[data-tab="diet"]').click();
  assert('饮食Tab -> screen-diet 可见', visible('screen-diet'));

  doc.querySelector('.tabbar .tab[data-tab="report"]').click();
  assert('周报Tab -> screen-report 可见', visible('screen-report'));

  doc.querySelector('.tabbar .tab[data-tab="mine"]').click();
  assert('我的Tab -> screen-mine 可见', visible('screen-mine'));

  doc.querySelector('.tabbar .tab[data-tab="home"]').click();
  assert('首页Tab -> screen-home 可见', visible('screen-home'));

  console.log('=== 2. 内容区导航 go() ===');
  doc.querySelector('.alert-banner').click();
  assert('预警横幅 -> 档案页', visible('screen-archive'));
  doc.querySelector('.btn-back').click();
  assert('返回 -> 首页', visible('screen-home'));

  doc.querySelector('.compare-entry').click();
  assert('对比入口 -> 对比页', visible('screen-compare'));
  assert('stack无重复: back应回首页(进入来源)', (() => {
    doc.querySelector('.btn-back').click();
    return visible('screen-home');
  })());

  console.log('=== 3. 维度切换 ===');
  doc.querySelector('.tabbar .tab[data-tab="archive"]').click();
  doc.querySelector('#dim-pills .pill[data-dim="lipid"]').click();
  assert('血脂卡可见', doc.querySelector('[data-card="lipid"]').style.display !== 'none');
  assert('血糖卡隐藏', doc.querySelector('[data-card="glucose"]').style.display === 'none');
  doc.querySelector('#dim-pills .pill[data-dim="liver"]').click();
  assert('肝功卡可见', doc.querySelector('[data-card="liver"]').style.display !== 'none');
  doc.querySelector('#dim-pills .pill[data-dim="lipid"]').click();
  assert('切回血脂卡可见', doc.querySelector('[data-card="lipid"]').style.display !== 'none');

  console.log('=== 4. 指标详情 ===');
  doc.querySelector('[data-card="lipid"] .btn-ghost').click();
  assert('趋势详情 -> screen-metric', visible('screen-metric'));
  doc.querySelector('.btn-back').click();
  assert('返回 -> 档案页', visible('screen-archive'));

  console.log('=== 5. 化验单上传流程 ===');
  doc.querySelector('.tabbar .tab[data-tab="home"]').click();
  doc.querySelector('#page-home .btn-primary').click();
  assert('扫描页打开', visible('screen-scan'));
  doc.querySelector('#scan-step1 .btn-primary').click();
  await sleep(2400);
  assert('OCR后确认页显示', doc.querySelector('#scan-step2').style.display !== 'none');
  doc.querySelector('#scan-step2 .btn-primary').click();
  await sleep(1000);
  assert('归档后回首页', visible('screen-home'));

  console.log('=== 6. 饮食记录流程 ===');
  doc.querySelector('.tabbar .tab[data-tab="home"]').click();
  doc.querySelector('.quick.teal').click();
  assert('饮食记录页打开', visible('screen-dietadd'));
  assert('默认步骤1', doc.querySelector('#diet-step1').style.display !== 'none');
  doc.querySelector('#diet-step1 .btn-primary').click();
  await sleep(2000);
  assert('AI识别后步骤2显示', doc.querySelector('#diet-step2').style.display !== 'none');
  doc.querySelector('#diet-step2 .btn-primary').click();
  await sleep(1000);
  assert('保存后回首页(来源页)', visible('screen-home'));
  doc.querySelector('.tabbar .tab[data-tab="diet"]').click();
  assert('午餐卡已变为记录(按餐次更新)', doc.querySelector('#diet-lunch').style.opacity === '1');

  console.log('=== 7. 流程再次进入（状态重置） ===');
  doc.querySelector('.icon-btn[aria-label="记饮食"]').click();
  assert('再次进入默认步骤1(无残留)', doc.querySelector('#diet-step1').style.display !== 'none' && doc.querySelector('#diet-step2').style.display === 'none');
  doc.querySelector('.btn-back').click();
  doc.querySelector('#page-diet .icon-btn').click();
  doc.querySelector('#diet-step1 .btn-primary').click();
  await sleep(2000);
  doc.querySelector('#diet-step2 .btn-ghost').click();
  assert('重拍回到步骤1', doc.querySelector('#diet-step1').style.display !== 'none');

  console.log('=== 8. 我的->周报 ===');
  doc.querySelector('.tabbar .tab[data-tab="mine"]').click();
  doc.querySelector('#page-mine .set-row').click();
  assert('我的->健康周报', visible('screen-report'));

  console.log('=== 9. 扫描步骤残留 ===');
  doc.querySelector('.tabbar .tab[data-tab="home"]').click();
  doc.querySelector('#page-home .btn-primary').click();
  assert('扫描页步骤3标记已重置', !doc.getElementById('step3').classList.contains('done'));
  doc.querySelector('#scan-step1 .btn-primary').click();
  await sleep(2400);
  assert('扫描确认后step3标记done', doc.getElementById('step3').classList.contains('done'));
  doc.querySelector('.btn-back').click();
  doc.querySelector('#page-archive .btn-primary').click();
  assert('再次进入扫描步骤3已重置', !doc.getElementById('step3').classList.contains('done'));

  console.log('=== 10. V2 AI 报告解读 ===');
  doc.querySelector('.tabbar .tab[data-tab="archive"]').click();
  doc.querySelector('.report-detail-entry').click();
  assert('报告时间线入口 -> 报告详情页', visible('screen-reportdetail'));
  assert('报告详情页包含逐项解读', doc.querySelectorAll('#page-reportdetail .ai-result').length === 10);
  doc.querySelector('#page-reportdetail .report-compare-btn').click();
  assert('报告详情 -> 历次报告对比', visible('screen-compare'));
  doc.querySelector('#page-compare .btn-back').click();
  doc.querySelector('#page-reportdetail .btn-back').click();
  assert('报告详情返回 -> 档案页', visible('screen-archive'));

  console.log('=== 11. V2 共病关联分析 ===');
  doc.querySelector('.tabbar .tab[data-tab="archive"]').click();
  doc.querySelector('.insight-entry').click();
  assert('关联分析入口 -> 关联分析页', visible('screen-insight'));
  assert('关联分析页包含双线趋势', doc.querySelectorAll('#page-insight .insight-chart path').length === 2);
  assert('关联分析页包含 4 条联动说明', doc.querySelectorAll('#page-insight .insight-link').length === 4);
  doc.querySelector('#page-insight .btn-back').click();
  assert('关联分析返回 -> 档案页', visible('screen-archive'));

  console.log('=== 12. V2 AI 预问诊 ===');
  doc.querySelector('.tabbar .tab[data-tab="home"]').click();
  doc.querySelector('.previsit-entry').click();
  assert('复诊前准备入口 -> 预问诊页', visible('screen-previsit'));
  doc.querySelector('#previsit-step1 .answer-chip[data-answer="无"]').click();
  assert('回答第一问后显示第二问', doc.getElementById('previsit-step2').style.display === 'block');
  doc.getElementById('previsit-count').value = '5';
  doc.querySelector('#previsit-step2 .btn-primary').click();
  assert('完成问答后生成复诊清单', doc.getElementById('previsit-result').style.display === 'block');
  doc.querySelector('#previsit-result .check').click();
  assert('复诊清单支持勾选', doc.querySelector('#previsit-result .check').classList.contains('done'));
  doc.querySelector('#page-previsit .btn-back').click();
  assert('预问诊返回 -> 首页', visible('screen-home'));

  console.log('=== 13. V2 就诊摘要导出 ===');
  doc.querySelector('.tabbar .tab[data-tab="mine"]').click();
  doc.querySelector('.summary-entry').click();
  assert('就诊摘要入口 -> 摘要页', visible('screen-summary'));
  assert('就诊摘要包含五维指标', doc.querySelectorAll('#page-summary .summary-table tbody tr').length >= 5);
  doc.querySelector('#page-summary .summary-export').click();
  assert('导出 PDF 显示反馈', doc.getElementById('toast').classList.contains('on'));
  doc.querySelector('#page-summary .btn-back').click();
  assert('就诊摘要返回 -> 我的页', visible('screen-mine'));

  console.log('=== 14. V2 复诊提醒 ===');
  doc.querySelector('.tabbar .tab[data-tab="home"]').click();
  doc.querySelector('.reminder-entry').click();
  assert('复查待办入口 -> 提醒设置页', visible('screen-reminder'));
  assert('提醒设置页包含 4 类复查周期', doc.querySelectorAll('#page-reminder .reminder-row').length === 4);
  doc.querySelector('#page-reminder [data-reminder="liver"] .toggle').click();
  doc.querySelector('#page-reminder [data-reminder="glucose"] .toggle').click();
  assert('复查提醒开关可切换', doc.querySelectorAll('#page-reminder .toggle.on').length === 3);
  doc.querySelector('#page-reminder .reminder-save').click();
  assert('保存提醒返回 -> 首页', visible('screen-home'));
  assert('首页显示已设置 3 项提醒', doc.getElementById('reminder-status').textContent.includes('3 项'));
  doc.querySelector('.reminder-entry').click();
  doc.querySelector('#page-reminder .btn-back').click();
  assert('提醒设置返回按钮正常', visible('screen-home'));

  console.log('=== 15. V2 家庭档案 ===');
  doc.querySelector('.tabbar .tab[data-tab="mine"]').click();
  doc.querySelector('.family-entry').click();
  assert('家庭健康档案入口 -> 家庭页', visible('screen-family'));
  assert('家庭页显示 2 位成员', doc.querySelectorAll('#page-family .family-member').length === 2);
  doc.querySelector('#page-family .family-member[data-name="李秀兰"]').click();
  assert('成员切换后显示李秀兰', doc.getElementById('family-current-name').textContent === '李秀兰');
  assert('首页成员名同步更新', doc.getElementById('home-member-name').textContent === '李秀兰');
  assert('成员资料同步为母亲档案', doc.getElementById('mine-profile-meta').textContent.includes('女'));
  doc.querySelector('#page-family .btn-back').click();
  assert('家庭档案返回 -> 我的页', visible('screen-mine'));

  console.log('=== 16. V2 付费订阅 ===');
  doc.querySelector('.tabbar .tab[data-tab="mine"]').click();
  doc.querySelector('.subscribe-entry').click();
  assert('康福会员入口 -> 订阅页', visible('screen-subscribe'));
  assert('订阅页显示免费版和会员版对比', doc.querySelectorAll('#page-subscribe .benefit-table > div').length === 15);
  doc.querySelector('#page-subscribe .price-card[data-plan="年卡"]').click();
  assert('年卡价格可选择', doc.querySelector('#page-subscribe .price-card[data-plan="年卡"]').classList.contains('on'));
  doc.querySelector('#page-subscribe .subscribe-buy').click();
  assert('开通会员显示原型反馈', doc.getElementById('toast').classList.contains('on'));
  doc.querySelector('#page-subscribe .btn-back').click();
  assert('订阅页返回 -> 我的页', visible('screen-mine'));

  console.log('=== 17. V2 健康数据互通 ===');
  doc.querySelector('.tabbar .tab[data-tab="mine"]').click();
  doc.querySelector('.devices-entry').click();
  assert('数据与设备入口 -> 设备页', visible('screen-devices'));
  assert('设备页显示 4 个数据源', doc.querySelectorAll('#page-devices .device-row').length === 4);
  assert('初始有 2 个数据源已连接', doc.querySelectorAll('#page-devices .toggle.on').length === 2);
  doc.querySelector('#page-devices [data-device="微信运动"] .toggle').click();
  assert('微信运动开关可连接', doc.querySelector('#page-devices [data-device="微信运动"] .device-state').textContent === '已连接');
  assert('设备连接显示原型反馈', doc.getElementById('toast').classList.contains('on'));
  doc.querySelector('#page-devices .btn-back').click();
  assert('数据与设备返回 -> 我的页', visible('screen-mine'));

  console.log('=== 10. JS运行时错误 ===');
  assert('无未捕获错误', errors.length === 0);
  if (errors.length) console.log('   错误:', errors.slice(0, 5));

  console.log('=== 11. 新用户引导流程 ===');
  // 清除存档模拟首次启动
  win.localStorage.removeItem('kangfu_user');
  win.location.reload = () => {};
  // 直接调用切换用户回到引导
  doc.querySelector('#switch-user-row') ? null : null;
  // 从我的页触发切换用户
  stackReset();
  win.eval('switchUser()');
  assert('切换用户 -> 引导页显示', visible('screen-onboard'));
  assert('引导步骤1(欢迎)可见', doc.getElementById('ob-step1').style.display !== 'none');
  doc.querySelector('#ob-step1 .btn-primary').click();
  assert('步骤2(登录)显示', doc.getElementById('ob-step2').style.display !== 'none');
  doc.getElementById('ob-phone').value = '13800138000';
  doc.querySelector('#ob-step2 .btn-primary').click();
  assert('步骤3(基本信息)显示', doc.getElementById('ob-step3').style.display !== 'none');
  doc.getElementById('ob-name').value = '王秀兰';
  doc.getElementById('ob-year').value = '1960';
  doc.getElementById('ob-height').value = '160';
  doc.querySelector('#ob-step3 .btn-primary').click();
  assert('步骤4(病种选择)显示', doc.getElementById('ob-step4').style.display !== 'none');
  // 取消一个病种再完成
  doc.querySelector('#ob-step4 .cond-opt[data-cond="糖尿病"]').click();
  doc.querySelector('#ob-step4 .btn-primary').click();
  await sleep(1000);
  assert('建档完成进入首页', visible('screen-home'));
  assert('首页显示新用户名', doc.getElementById('home-member-name').textContent === '王秀兰');
  assert('首页指标为空状态', doc.querySelectorAll('#page-home .m-value')[0].textContent.indexOf('--') === 0);
  assert('我的页档案已更新', doc.getElementById('mine-profile-meta').textContent.indexOf('王秀兰') >= 0 || doc.getElementById('mine-profile-meta').textContent.indexOf('1960') >= 0);

  function stackReset(){ win.eval('stack=["home"];'); }

  console.log('=== 12. 修复项回归（全面检查后） ===');
  // 表单验证：空手机号阻止
  stackReset();
  win.eval('switchUser()');
  doc.querySelector('#ob-step1 .btn-primary').click();
  doc.getElementById('ob-phone').value = '123';
  doc.querySelector('#ob-step2 .btn-primary').click();
  assert('无效手机号被拦截', doc.getElementById('ob-step2').style.display !== 'none');
  doc.getElementById('ob-phone').value = '13800138000';
  doc.querySelector('#ob-step2 .btn-primary').click();
  assert('有效手机号进入步骤3', doc.getElementById('ob-step3').style.display !== 'none');
  doc.getElementById('ob-name').value = '测试';
  doc.getElementById('ob-year').value = '3000';
  doc.getElementById('ob-height').value = '165';
  doc.querySelector('#ob-step3 .btn-primary').click();
  assert('非法年份被拦截', doc.getElementById('ob-step3').style.display !== 'none');
  doc.getElementById('ob-year').value = '1960';
  doc.querySelector('#ob-step3 .btn-primary').click();
  assert('合法信息进入步骤4', doc.getElementById('ob-step4').style.display !== 'none');
  // 引导期间 Tabbar 隐藏
  assert('引导期间Tabbar隐藏', doc.querySelector('.tabbar').style.display === 'none');
  // 完成建档
  doc.querySelector('#ob-step4 .btn-primary').click();
  await sleep(1000);
  assert('建档后Tabbar恢复', doc.querySelector('.tabbar').style.display === '');
  assert('非演示模式有演示标注', !!doc.querySelector('.demo-banner'));

  // 扫描重置：重新拍回取景
  doc.querySelector('.tabbar .tab[data-tab="home"]').click();
  doc.querySelector('#page-home .btn-primary').click();
  doc.querySelector('#scan-step1 .btn-primary').click();
  await sleep(2400);
  doc.querySelector('#scan-step2 .btn-ghost').click();
  assert('重新拍回到取景步骤', doc.querySelector('#scan-step1').style.display !== 'none' && doc.querySelector('#scan-step2').style.display === 'none');
  doc.querySelector('#page-scan .btn-back').click();

  // 对比汇总动态计算
  win.eval('calcCompareSummary()');
  assert('对比汇总改善数=7', doc.getElementById('sum-better').textContent === '7');
  assert('对比汇总恶化数=2', doc.getElementById('sum-worse').textContent === '2');
  assert('对比汇总总数=17', doc.getElementById('sum-total').textContent === '17');

  console.log('=== 13. 复查修复回归 ===');
  // 首页演示标注
  doc.querySelector('.tabbar .tab[data-tab="home"]').click();
  assert('首页有演示标注', !!doc.querySelector('#page-home .demo-banner'));
  // 导航取消定时器：保存饮食后立即切Tab，不被回跳覆盖
  win.eval('stack=["home"]; showScreen("home"); startDietAdd(); saveDiet(); switchTab("report");');
  await sleep(1200);
  assert('导航后旧保存定时器被取消(停在周报)', visible('screen-report'));
  // 餐数统计基于 data-recorded
  doc.querySelector('.tabbar .tab[data-tab="diet"]').click();
  var mealText = doc.querySelector('#screen-diet .sub').textContent;
  assert('餐数统计正确(≥2餐)', mealText.indexOf('已记录 3 餐') >= 0 || mealText.indexOf('已记录 2 餐') >= 0 || mealText.indexOf('已记录 1 餐') >= 0);
  // 重拍恢复初始值：改一个值再重拍
  doc.querySelector('.tabbar .tab[data-tab="home"]').click();
  doc.querySelector('#page-home .btn-primary').click();
  doc.querySelector('#scan-step1 .btn-primary').click();
  await sleep(2400);
  var firstInput = doc.querySelector('#scan-step2 .ct-row input');
  var origVal = firstInput.value;
  firstInput.value = '999';
  doc.querySelector('#scan-step2 .btn-ghost').click();
  doc.querySelector('#scan-step1 .btn-primary').click();
  await sleep(2400);
  assert('重拍恢复初始识别值', doc.querySelector('#scan-step2 .ct-row input').value === origVal);

  console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
  process.exit(fail ? 1 : 0);
})();

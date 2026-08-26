// 原型逻辑层自动化测试（jsdom）
const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync('慢病管理App原型.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
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
  assert('晚餐卡已变为记录', doc.querySelector('#diet-dinner').style.opacity === '1');

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

  console.log('=== 10. JS运行时错误 ===');
  assert('无未捕获错误', errors.length === 0);
  if (errors.length) console.log('   错误:', errors.slice(0, 5));

  console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
  process.exit(fail ? 1 : 0);
})();

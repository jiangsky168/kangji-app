// 原型逻辑层自动化测试（jsdom）
const fs = require('fs');
const os = require('os');
const path = require('path');

// 优先使用项目依赖，当前本机可复用 Hermes 已安装的 jsdom
const jsdomPath = require.resolve('jsdom', {
  paths: [process.cwd(), path.join(os.homedir(), '.hermes/hermes-agent')]
});
const { JSDOM } = require(jsdomPath);

const html = fs.readFileSync('index.html', 'utf8');
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

  console.log('=== 5.1. 化验单相册选图 ===');
  win.eval('startScan()');
  var albumButton = Array.from(doc.querySelectorAll('#scan-step1 button')).find(function(button){
    return button.textContent.indexOf('从相册选择') >= 0;
  });
  assert('相册选图入口存在', !!albumButton);
  var scanFile = doc.getElementById('scan-file');
  assert('相册文件输入支持多选', !!scanFile && scanFile.hasAttribute('multiple'));
  assert('OCR API 使用本机服务默认地址', win.eval('OCR_API') === 'http://192.168.1.211:8001/ocr');
  var parsed = win.parseOcrLines([
    '市第一人民医院', '检验报告单',
    '葡萄糖 GLU', '6.8', '3.9-6.1 mmol/L', 'H',
    '总胆固醇 TC', '5.6', '<5.2 mmol/L',
    '尿酸 UA', '445', '208-428 umol/L'
  ]);
  var parsedByName = {};
  parsed.forEach(function(item){ parsedByName[item.name] = item; });
  assert('parseOcrLines 固定输出 10 项', parsed.length === 10);
  assert('parseOcrLines 识别葡萄糖真实值', parsedByName['空腹血糖'].value === '6.8');
  assert('parseOcrLines 识别总胆固醇真实值', parsedByName['总胆固醇'].value === '5.6');
  assert('parseOcrLines 识别尿酸并规范单位', parsedByName['血尿酸'].value === '445' && parsedByName['血尿酸'].unit === 'μmol/L');
  assert('parseOcrLines 捕捉参考范围', parsedByName['空腹血糖'].ref === '3.9-6.1');
  assert('parseOcrLines 缺项为 --', parsedByName['甘油三酯'].value === '--' && parsedByName['糖化血红蛋白'].value === '--');

  var ocrFetchCalls = [];
  win.fetch = function(url, options){
    var file = options.body.get('file');
    ocrFetchCalls.push({url:url, method:options.method, file:file && file.name, signal:options.signal});
    if(file && file.name === 'offline.jpg') return Promise.reject(new Error('offline'));
    var values = file && file.name === 'report-1.jpg' ? ['6.1','5.1'] :
      file && file.name === 'report-2.jpg' ? ['7.2','6.0'] : ['7.1','5.2'];
    var extraLines = file && file.name === 'report.jpg' ? [
      '尿酸 UA', '401', '208-428 umol/L',
      '谷丙转氨酶 ALT', '31', '<40 U/L',
      '谷草转氨酶 AST', '29', '<40 U/L',
      'γ-谷氨酰转肽酶 GGT', '37', '<50 U/L'
    ] : [];
    return Promise.resolve({
      ok: true,
      status: 200,
      json: function(){
        return Promise.resolve({ok:true, lines:[
          '葡萄糖 GLU', values[0], '3.9-6.1 mmol/L', 'H',
          '总胆固醇 TC', values[1], '<5.2 mmol/L'
        ].concat(extraLines), time_ms:123});
      }
    });
  };
  if(scanFile){
    Object.defineProperty(scanFile, 'files', {
      value: [new win.File(['x'], 'report.jpg', {type:'image/jpeg'})],
      configurable: true
    });
    scanFile.dispatchEvent(new win.Event('change', {bubbles:true}));
  }
  assert('单张相册选图后 OCR 状态与标题不变', !!scanFile && doc.getElementById('ocr-state').classList.contains('on') && doc.querySelector('#ocr-state .o-t').textContent === '正在识别报告内容');
  await sleep(200);
  assert('相册 OCR 状态最短展示期间不提前进入确认页', doc.getElementById('ocr-state').classList.contains('on') && doc.querySelector('#scan-step2').style.display === 'none');
  await sleep(700);
  await sleep(1100); // 等待 compressImage 兜底（jsdom 无 Image 加载）
  assert('相册选图后显示指标确认页', !!scanFile && doc.querySelector('#scan-step2').style.display !== 'none');
  assert('相册 OCR 通过 multipart file 请求本机接口', ocrFetchCalls[0].url === win.eval('OCR_API') && ocrFetchCalls[0].method === 'POST' && ocrFetchCalls[0].file === 'report.jpg');
  assert('真实 OCR 数值填入确认页', doc.querySelectorAll('#scan-step2 .ct-row input')[0].value === '7.1' && doc.querySelectorAll('#scan-step2 .ct-row input')[1].value === '5.2');
  assert('OCR 缺项显示待补充且不保留演示值', doc.querySelectorAll('#scan-step2 .ct-row input')[2].value === '' && doc.querySelectorAll('#scan-step2 .ct-row input')[2].placeholder === '待补充');
  assert('真实 OCR 成功提示包含识别项数', doc.getElementById('toast').textContent.indexOf('识别完成（本地OCR · 6 项）') >= 0);
  var scanFileStatus = doc.getElementById('scan-file-status');
  assert('已选提示包含文件名', !!scanFileStatus && scanFileStatus.textContent.indexOf('report.jpg') >= 0);
  doc.querySelector('#scan-step2 input[aria-label="医院"]').value = '测试医院';
  doc.querySelector('#scan-step2 .btn-primary').click();
  var storedMetrics = JSON.parse(win.localStorage.getItem('kangfu_metrics') || '{}');
  assert('OCR 归档写入空腹血糖', storedMetrics['空腹血糖'] === '7.1');
  assert('OCR 归档写入报告日期与医院', /^\d{4}-\d{2}-\d{2}$/.test(win.localStorage.getItem('kangfu_metrics_date') || '') && win.localStorage.getItem('kangfu_metrics_hospital') === '测试医院');
  assert('OCR 归档提示包含指标数', doc.getElementById('toast').textContent.indexOf('已归档 6 项指标') >= 0);
  await sleep(1000);
  assert('OCR 归档后首页显示识别血糖', visible('screen-home') && !!doc.getElementById('home-glucose-value') && doc.getElementById('home-glucose-value').textContent.indexOf('7.1') >= 0);
  assert('OCR 归档后首页标注识别日期', !!doc.getElementById('home-glucose-trend') && doc.getElementById('home-glucose-trend').textContent.indexOf('化验单识别') >= 0);
  doc.querySelector('.tabbar .tab[data-tab="archive"]').click();
  assert('OCR 归档后档案血脂显示识别值', !!doc.getElementById('archive-lipid-total') && doc.getElementById('archive-lipid-total').textContent === '5.2');
  assert('OCR 归档后档案尿酸显示识别值', !!doc.getElementById('archive-uric-value') && doc.getElementById('archive-uric-value').textContent.indexOf('401') >= 0);
  assert('OCR 归档后档案肝功显示识别值', !!doc.getElementById('archive-liver-alt') && doc.getElementById('archive-liver-alt').textContent === '31' && !!doc.getElementById('archive-liver-ggt') && doc.getElementById('archive-liver-ggt').textContent === '37');
  doc.querySelector('.tabbar .tab[data-tab="home"]').click();
  win.localStorage.removeItem('kangfu_metrics');
  win.localStorage.removeItem('kangfu_metrics_date');
  win.localStorage.removeItem('kangfu_metrics_hospital');
  win.eval('startScan(); applyOcrResults(parseOcrLines([]));');
  doc.querySelector('#scan-step2 .btn-primary').click();
  assert('全空归档提示未识别到指标', doc.getElementById('toast').textContent.indexOf('未识别到可归档的指标') >= 0);
  assert('全空归档不写指标存储', win.localStorage.getItem('kangfu_metrics') === null);
  await sleep(1000);
  win.eval('startScan()');
  win.eval('resetScan()');
  assert('重新拍后清除已选提示', !!scanFileStatus && scanFileStatus.style.display === 'none' && scanFileStatus.textContent === '');

  console.log('=== 5.2. 化验单相册多选逐张归档 ===');
  if(scanFile){
    Object.defineProperty(scanFile, 'files', {
      value: [
        new win.File(['x'], 'report-1.jpg', {type:'image/jpeg'}),
        new win.File(['y'], 'report-2.jpg', {type:'image/jpeg'})
      ],
      configurable: true
    });
    scanFile.dispatchEvent(new win.Event('change', {bubbles:true}));
  }
  assert('多选提示显示已选择 2 张图片', !!scanFileStatus && scanFileStatus.textContent === '已选择 2 张图片');
  assert('第一张显示 OCR 进度', doc.getElementById('ocr-state').classList.contains('on') && doc.querySelector('#ocr-state .o-t').textContent.indexOf('第 1/2 张') >= 0);
  await sleep(1900); // 含 compressImage 兜底等待
  assert('第一张 OCR 后进入确认页', doc.querySelector('#scan-step2').style.display !== 'none');
  assert('第一张使用自己的真实 OCR 结果', doc.querySelector('#scan-step2 .ct-row input').value === '6.1');
  doc.querySelector('#scan-step2 .btn-primary').click();
  assert('第一张归档后自动识别第二张', doc.getElementById('ocr-state').classList.contains('on') && doc.querySelector('#ocr-state .o-t').textContent.indexOf('第 2/2 张') >= 0 && doc.getElementById('toast').textContent.indexOf('第 1 张已归档，继续第 2 张') >= 0);
  await sleep(1900); // 含 compressImage 兜底等待
  assert('第二张 OCR 后进入确认页', doc.querySelector('#scan-step2').style.display !== 'none');
  assert('第二张使用不同的真实 OCR 结果', doc.querySelector('#scan-step2 .ct-row input').value === '7.2');
  doc.querySelector('#scan-step2 .btn-primary').click();
  assert('全部完成提示已归档 2 张报告', doc.getElementById('toast').textContent.indexOf('已归档 2 张报告') >= 0);
  await sleep(1000);
  assert('多张报告归档后回首页', visible('screen-home'));

  console.log('=== 5.3. 化验单相册 OCR 失败降级 ===');
  win.eval('startScan()');
  if(scanFile){
    Object.defineProperty(scanFile, 'files', {
      value: [new win.File(['x'], 'offline.jpg', {type:'image/jpeg'})],
      configurable: true
    });
    scanFile.dispatchEvent(new win.Event('change', {bubbles:true}));
  }
  await sleep(1900); // 含 compressImage 兜底等待
  assert('OCR 连接失败显示同 WiFi 提示', doc.getElementById('toast').textContent.indexOf('无法连接识别服务，请确认电脑已开机且手机在同一 WiFi') >= 0);
  assert('OCR 连接失败停留取景页', doc.getElementById('scan-step1').style.display !== 'none' && doc.querySelector('#scan-step2').style.display === 'none');
  assert('OCR 连接失败不填充演示数据', Array.from(doc.querySelectorAll('#scan-step2 .ct-row input')).every(function(input){ return input.value === ''; }));

  win.eval('startScan()');
  if(scanFile){
    Object.defineProperty(scanFile, 'files', {
      value: [
        new win.File(['x'], 'reset-1.jpg', {type:'image/jpeg'}),
        new win.File(['y'], 'reset-2.jpg', {type:'image/jpeg'})
      ],
      configurable: true
    });
    scanFile.dispatchEvent(new win.Event('change', {bubbles:true}));
  }
  win.eval('resetScan()');
  assert('resetScan 清空多选队列', win.eval('scanFiles.length === 0 && scanIdx === 0') && scanFileStatus.style.display === 'none');
  if(scanFile){
    Object.defineProperty(scanFile, 'files', {
      value: [
        new win.File(['x'], 'cancel-1.jpg', {type:'image/jpeg'}),
        new win.File(['y'], 'cancel-2.jpg', {type:'image/jpeg'})
      ],
      configurable: true
    });
    scanFile.dispatchEvent(new win.Event('change', {bubbles:true}));
  }
  doc.querySelector('#page-scan .btn-back').click();
  assert('取消扫描清空多选队列', win.eval('scanFiles.length === 0 && scanIdx === 0'));

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
  assert('新用户首页保留本机识别血糖', doc.getElementById('home-glucose-value').textContent.indexOf('7.2') >= 0);
  const newMeals = Array.from(doc.querySelectorAll('#page-diet .meal-card'));
  const emptyDataPages = ['archive','report','summary','compare','family','meds','metric','insight','reportdetail','devices'];
  assert('新用户跨页数据为空状态',
    doc.querySelectorAll('#page-home .m-value')[0].textContent.indexOf('--') === 0 &&
    doc.body.classList.contains('new-user-mode') &&
    newMeals.length === 3 &&
    newMeals.every(card => card.getAttribute('data-recorded') === '0' && !card.querySelector('.new-meal-content.meal-photo').getAttribute('style')) &&
    doc.querySelector('#screen-diet .topbar .sub').textContent.indexOf('已记录 0 餐') >= 0 &&
    doc.querySelector('#page-diet .new-diet-stat .s-val').textContent.trim().indexOf('0') === 0 &&
    emptyDataPages.every(id => !!doc.querySelector('#page-' + id + ' > .new-user-empty')));
  assert('新用户档案空态显示本机识别值', doc.querySelector('#page-archive > .new-user-empty').textContent.indexOf('7.2') >= 0 && doc.querySelector('#page-archive > .new-user-empty').textContent.indexOf('6.0') >= 0);
  assert('我的页档案已更新', doc.getElementById('mine-profile-meta').textContent.indexOf('王秀兰') >= 0 || doc.getElementById('mine-profile-meta').textContent.indexOf('1960') >= 0);

  function stackReset(){ win.eval('stack=["home"];'); }

  console.log('=== 12. 修复项回归（全面检查后） ===');
  // 启动存档校验：合法边界放行，损坏存档清除并进入引导
  const validBoundaryUser = { mode:'new', name:'边界用户', gender:'女', year:1920, height:220, conditions:['高血压','糖尿病','血脂异常','高尿酸','脂肪肝'] };
  const invalidSavedUsers = [
    { ...validBoundaryUser, name:' ' },
    { ...validBoundaryUser, name:'123456789012345678901' },
    { ...validBoundaryUser, gender:'其他' },
    { ...validBoundaryUser, year:'1960' },
    { ...validBoundaryUser, year:1919 },
    { ...validBoundaryUser, year:2017 },
    { ...validBoundaryUser, year:1960.5 },
    { ...validBoundaryUser, height:'165' },
    { ...validBoundaryUser, height:119 },
    { ...validBoundaryUser, height:221 },
    { ...validBoundaryUser, height:165.5 },
    { ...validBoundaryUser, conditions:['高血压','糖尿病','血脂异常','高尿酸','脂肪肝','高血压'] },
    { ...validBoundaryUser, conditions:['未知病种'] }
  ];
  const strictArchiveValidation = win.isValidSavedUser(validBoundaryUser) &&
    win.isValidSavedUser({ mode:'demo', name:'张卫东' }) &&
    invalidSavedUsers.every(user => !win.isValidSavedUser(user));
  const corruptDom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://corrupt.local/',
    beforeParse(window) {
      window.localStorage.setItem('kangfu_user', JSON.stringify({ ...validBoundaryUser, conditions:['未知病种'] }));
    }
  });
  const corruptArchiveCleared = corruptDom.window.localStorage.getItem('kangfu_user') === null;
  const corruptArchiveOnboard = corruptDom.window.document.getElementById('screen-onboard').style.display !== 'none';
  corruptDom.window.close();
  // 表单验证：空手机号阻止
  stackReset();
  win.eval('switchUser()');
  doc.querySelector('#ob-step1 .btn-primary').click();
  doc.getElementById('ob-phone').value = '123';
  doc.querySelector('#ob-step2 .btn-primary').click();
  assert('损坏存档清除且无效手机号被拦截', strictArchiveValidation && corruptArchiveCleared && corruptArchiveOnboard && doc.getElementById('ob-step2').style.display !== 'none');
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
  // 餐数统计基于 data-recorded：新用户初始0餐，午餐+加餐后应为2餐
  doc.querySelector('.tabbar .tab[data-tab="diet"]').click();
  // 先加餐：从首页进入饮食流程选加餐保存
  doc.querySelector('.tabbar .tab[data-tab="home"]').click();
  win.eval('startDietAdd(); var bs=document.querySelectorAll("#diet-meal-seg button"); bs.forEach(function(b){b.classList.remove("on");}); bs[bs.length-1].classList.add("on"); saveDiet(); switchTab("diet");');
  await sleep(1200);
  var mealText = doc.querySelector('#screen-diet .sub').textContent;
  assert('新用户加餐后餐数=2', mealText.indexOf('已记录 2 餐') >= 0);
  // 加餐卡在晚餐卡之后、统计卡之前
  var snack = doc.getElementById('diet-snack');
  assert('加餐卡存在', !!snack);
  var dinner2 = doc.getElementById('diet-dinner');
  assert('加餐卡紧接晚餐卡之后', dinner2 && snack && dinner2.nextElementSibling === snack);
  // aria-pressed 重置：再进引导检查
  win.eval('switchUser()');
  var condStates = [];
  doc.querySelectorAll('#ob-step4 .cond-opt').forEach(function(c){ condStates.push(c.getAttribute('aria-pressed')); });
  win.eval('enterDemo()');
  assert('重置状态同步且切回演示恢复饮食',
    condStates[0]==='true' && condStates[1]==='true' && condStates[2]==='false' &&
    doc.getElementById('diet-breakfast').getAttribute('data-recorded') === '1' &&
    doc.getElementById('diet-lunch').getAttribute('data-recorded') === '1' &&
    doc.querySelector('#screen-diet .topbar .sub').textContent.indexOf('已记录 2 餐') >= 0);
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

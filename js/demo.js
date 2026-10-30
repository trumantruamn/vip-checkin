/* 預覽／示範模式：在瀏覽器內執行與 Google Apps Script 相同的 Code.gs（以模擬試算表存在 localStorage）。 */
(function () {
'use strict';
var KEY = 'vipdemo.world', gas = null;
function make() {
  gas = window.GasMock.create({source: window.VIPDEMO_SRC, adminCode: 'admin', store: {get: function () { return localStorage.getItem(KEY); }, set: function (s) { localStorage.setItem(KEY, s); }}});
}
function U_lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function call(o) { return JSON.parse(gas.handle(JSON.stringify(o))); }
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var SUR = '陳林黃張李王吳劉蔡楊許鄭謝郭洪曾邱廖賴徐周葉蘇莊呂江何蕭羅高潘簡朱鍾游彭詹胡施沈余盧'.split('');
var GIV = ['志明', '淑芬', '家豪', '雅婷', '建宏', '怡君', '宗翰', '美玲', '俊傑', '佳穎', '文彬', '麗華', '冠宇', '怡萱', '柏翰', '雅雯', '承恩', '詩涵', '國棟', '惠琪', '明哲', '秀英', '弘毅', '靜怡', '世豪', '心怡', '泰安', '慧敏', '宇軒', '玉珍', '振華', '育廷', '孟潔', '昌隆', '婉如', '政宏', '佩珊', '偉倫', '淑惠', '元凱'];
var CATS = [
  ['中央機關', 40, ['經濟部', '交通部', '文化部', '教育部', '內政部', '衛福部', '數位發展部', '國發會'], ['部長', '次長', '司長', '主任秘書', '署長']],
  ['地方政府', 50, ['台北市政府', '新北市政府', '桃園市政府', '台中市政府', '高雄市政府', '台南市政府', '基隆市政府', '新竹縣政府'], ['市長', '副市長', '局長', '處長', '秘書長']],
  ['民意代表', 40, ['立法院', '台北市議會', '新北市議會', '桃園市議會', '台中市議會'], ['立法委員', '議員', '副議長', '議長']],
  ['企業貴賓', 90, ['三恆建設', '宏遠科技', '大安金控', '信義實業', '華光電子', '長青生技', '雲端數位', '北辰物流', '日昇食品', '永盛紡織'], ['董事長', '總經理', '副總經理', '執行長', '協理']],
  ['合作夥伴', 60, ['星河廣告', '光點文創', '遠見顧問', '凱旋公關', '大地工程', '博雅設計'], ['負責人', '總監', '經理', '合夥人']],
  ['學術單位', 40, ['台灣大學', '政治大學', '清華大學', '成功大學', '中央研究院', '工研院'], ['校長', '院長', '教授', '研究員', '所長']],
  ['社團協會', 40, ['工商協進會', '青商會', '扶輪社', '獅子會', '中小企業協會', '建築師公會'], ['理事長', '會長', '秘書長', '總幹事']],
  ['媒體', 20, ['中央社', '聯合報', '自由時報', '公視', '工商時報'], ['總編輯', '採訪主任', '記者']],
  ['一般來賓', 20, ['個人', '社區發展協會', '里辦公處'], ['來賓', '里長', '代表']]
];
function genRows(seed) {
  var R = rng(seed), rows = [], n = 0, rsvps = ['回覆出席', '回覆出席', '回覆出席', '回覆出席', '回覆出席', '回覆出席', '回覆出席', '未回覆', '未回覆', '請假', '代理出席'];
  var used = {};
  CATS.forEach(function (c) {
    for (var i = 0; i < c[1]; i++) {
      n++;
      var name; do { name = SUR[Math.floor(R() * SUR.length)] + GIV[Math.floor(R() * GIV.length)]; } while (used[name]); used[name] = 1;
      var rs = rsvps[Math.floor(R() * rsvps.length)];
      rows.push({seq: n, cat: c[0], org: c[2][Math.floor(R() * c[2].length)] + (R() < .4 ? ['辦公室', '股份有限公司', '秘書處'][Math.floor(R() * 3)] : ''), title: c[3][Math.floor(R() * c[3].length)], name: name, rsvp: rs,
        grp: ['A組', 'B組', 'C組'][Math.floor(R() * 3)], tbl: String(Math.floor((n - 1) / 10) + 1), note: rs === '代理出席' ? '代理人：' + SUR[Math.floor(R() * 40)] + '先生' : (R() < .04 ? '素食' : (R() < .03 ? '需無障礙座位' : ''))});
    }
  });
  return rows;
}
function seedBase() {
  localStorage.removeItem(KEY); make();
  var a = call({op: 'admin', code: 'admin', cmd: 'event.create', name: '2026屏東縣創新創業協會第29、30屆 理事長交接曁理監事會務幹部就職典禮', date: '2026-10-31', staff: '慶哥'});
  var ev = a.event.id, rows = genRows(20261031);
  for (var i = 0; i < rows.length; i += 200) call({op: 'admin', code: 'admin', ev: ev, cmd: 'guests.import', mode: 'replace', start: i === 0, rows: rows.slice(i, i + 200), staff: '慶哥'});
  return {ev: ev, codes: a.codes};
}
function seedLive(info) {
  var R = rng(77), all = call({op: 'sync', code: 'admin', ev: info.ev, since: 0}).recs, min = 60000;
  var codes = info.codes, per = {checkin: {}, reception: {}, stage: {}};
  var staff = {checkin: ['小美', '小華', '阿傑'], reception: ['接待1號', '接待2號', '接待3號'], stage: ['司儀小林']};
  function push(role, a) { var s = staff[role][Math.floor(R() * staff[role].length)]; (per[role][s] = per[role][s] || []).push(a); }
  var exp = all.filter(function (r) { return r.rsvp !== '請假'; });
  /* 主持人唱名順序：前 70 位（依名單序）排入順序 */
  var ordIds = exp.slice().sort(function (a, b) { return a.seq - b.seq; }).slice(0, 70), rank = {};
  ordIds.forEach(function (r, i) { rank[r.id] = i + 1; });
  call({op: 'ord', code: 'admin', ev: info.ev, cmd: 'set', list: ordIds.map(function (r, i) { return [r.id, i + 1]; }), staff: '慶哥'});
  exp.sort(function () { return R() - .5; });
  var nci = Math.round(exp.length * .55), arrivedList = exp.slice(0, nci), ciAge = {}, inA = {};
  arrivedList.forEach(function (r) { inA[r.id] = 1; ciAge[r.id] = (1 + R() * 74) * min; });
  ordIds.slice(0, 30).forEach(function (r) { if (!inA[r.id]) { arrivedList.push(r); inA[r.id] = 1; ciAge[r.id] = (30 + R() * 40) * min; } });
  arrivedList.forEach(function (r) { push('checkin', {a: 'st', g: r.id, s: 'ci', on: 1, age: ciAge[r.id], cid: 'sc' + r.id}); });
  var seatedIds = [];
  arrivedList.sort(function (a, b) { return ciAge[b.id] - ciAge[a.id]; }).forEach(function (r) {
    var age = ciAge[r.id], rk = rank[r.id] || 999;
    if (rk <= 14 || age > 12 * min || (age > 3 * min && R() < .6)) { var sa = Math.max(0.2 * min, age - (1 + R() * 4) * min); push('reception', {a: 'st', g: r.id, s: 'se', on: 1, age: sa, cid: 'ss' + r.id}); seatedIds.push([r, sa]); }
  });
  seatedIds.forEach(function (x) { if ((rank[x[0].id] || 999) <= 8) push('stage', {a: 'st', g: x[0].id, s: 'an', on: 1, age: Math.max(1000, x[1] - 60000), cid: 'sa' + x[0].id}); });
  ['現場貴賓甲', '現場貴賓乙', '臨時來賓丙'].forEach(function (nm, i) { push('checkin', {a: 'walkin', g: 'w' + (1000 + i) + 'seed', f: {name: nm, org: '臨時報到', title: '來賓', cat: '一般來賓', tbl: String(41 + i)}, age: (3 + i * 7) * min, cid: 'sw' + i}); });
  ['checkin', 'reception', 'stage'].forEach(function (role) {
    Object.keys(per[role]).forEach(function (st) {
      var acts = per[role][st];
      for (var i = 0; i < acts.length; i += 40) call({op: 'sync', code: codes.staff, sg: role, ev: info.ev, since: 0, staff: st, dev: 'demo', acts: acts.slice(i, i + 40).map(function (a) { a.gr = role; return a; })});
    });
  });
}
function seed(scn) { var info = seedBase(); if (scn === 'live') seedLive(info); localStorage.setItem('vipdemo.scn', scn); return info; }

window.VIPDEMO = {
  handle: function (b) { return gas.handle(b); },
  init: function () {
    make();
    if (new URLSearchParams(location.search).get('demo') === 'reset') { seed('live'); history.replaceState(null, '', location.pathname); }
    var r = call({op: 'login', code: 'admin'});
    if (!r.ok || !r.events || !r.events.length) seed('live');
    window.VIP.defaultName = function () { return {checkin: '小美', reception: '接待1號', stage: '司儀小林', director: '總召', admin: '慶哥'}[window.VIP.S.role === 'staff' ? window.VIP.S.grp : window.VIP.S.role] || ''; };
    return Promise.resolve();
  },
  resetAll: function (scn) {
    Object.keys(localStorage).forEach(function (k) { if (/^vip\.(st|lastrole|grp)/.test(k)) localStorage.removeItem(k); });
    seed(scn || 'live'); location.href = location.pathname;
  },
  launcher: function (el, tools, enter) {
    var r = call({op: 'login', code: 'admin'}), ev = r.events[0], codes = call({op: 'admin', code: 'admin', ev: ev.id, cmd: 'codes.get'}).codes;
    var items = [['checkin', '✅ 報到組'], ['reception', '🪑 接待組'], ['stage', '🎤 舞台組（主持人）'], ['director', '📊 總召（唯讀）'], ['admin', '⚙️ 後台管理']];
    var h = '<div class="muted small demo-code">工作人員「共用存取碼」：<b id="demo-staffcode">' + codes.staff + '</b>　（報到、接待、舞台、總召都用這一組，登入後在上方分頁切換）<br>後台密碼：<b>admin</b>（僅示範用）</div>';
    h += items.map(function (x) {
      var g = x[0] !== 'admin', c = x[0] === 'admin' ? 'admin' : codes.staff;
      return '<div class="dl"><button class="btn primary" data-go="' + c + '"' + (g ? ' data-grp="' + x[0] + '"' : '') + '>' + x[1] + '</button><a class="btn sm" target="_blank" href="?c=' + encodeURIComponent(c) + (g ? '#' + x[0] : '') + '">新分頁</a></div>';
    }).join('');
    el.innerHTML = h;
    el.onclick = function (e) { var b = e.target.closest('[data-go]'); if (b) { if (b.dataset.grp) U_lsSet('vip.grp', b.dataset.grp); enter(b.dataset.go); } };
    var lge = document.getElementById('lg-ev'); if (lge) { lge.textContent = ev.name; lge.style.display = ''; }
    tools.innerHTML = '<div class="muted small">目前活動：' + ev.name + '</div><button class="btn sm" id="dr1">重新產生：進行中情境（約 55% 已到）</button> <button class="btn sm" id="dr2">重新產生：全新未開始</button>';
    tools.querySelector('#dr1').onclick = function () { window.VIPDEMO.resetAll('live'); };
    tools.querySelector('#dr2').onclick = function () { window.VIPDEMO.resetAll('fresh'); };
  }
};
})();

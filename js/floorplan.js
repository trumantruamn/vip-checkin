/* 座位平面圖（v1.4）：版面設定（存在活動的 layout 欄，JSON）→ 平面圖。接待組、總召、後台共用。
   版面格式：{v:1, items:[{t:'table', id:'5', name:'第5桌', cap:10, x:2, y:3, w:1, h:1, main:1, alias:['主桌']},
                          {t:'stage'|'aisle'|'door'|'label', label:'舞　台', x, y, w, h}]}   （x＝第幾欄、y＝第幾列，從 1 開始） */
(function () {
'use strict';
var V = window.VIP, S = V.S, U = V.u, esc = U.esc, CFG = window.VIP_CONFIG || {};
var FP = V.fp = {};

/* ---------- 桌次比對：'1'、'1桌'、'第1桌'、'第 1 桌'、'１'、別名（例如 主桌）都視為同一桌 ---------- */
function key(t) {
  var s = String(t == null ? '' : t).replace(/[\s\u3000]+/g, '').replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 65248); });
  if (!s) return '';
  var m = /^第?0*(\d+)桌?$/.exec(s);
  return m ? m[1] : s.toLowerCase();
}
FP.key = key;
function num(v, lo, hi, d) { var n = Math.round(+v); if (!isFinite(n)) n = d; return Math.max(lo, Math.min(hi, n)); }

/* ---------- 讀取／整理版面（有任何問題就回傳 null → 畫面自動改回桌次清單） ---------- */
var cache = {src: null, out: null};
function normalize(raw) {
  if (!raw || typeof raw !== 'object' || !(raw.items instanceof Array) || !raw.items.length) return null;
  var items = [], tables = [], byKey = {}, maxX = 1, maxY = 1;
  raw.items.forEach(function (it) {
    if (!it || typeof it !== 'object') return;
    var t = String(it.t || ''); if (!/^(table|stage|aisle|door|label)$/.test(t)) return;
    var o = {t: t, x: num(it.x, 1, 40, 1), y: num(it.y, 1, 60, 1), w: num(it.w, 1, 40, 1), h: num(it.h, 1, 60, 1)};
    if (t === 'table') {
      o.id = String(it.id == null ? '' : it.id).trim(); if (!o.id) return;
      o.name = String(it.name || '').trim() || o.id; o.cap = num(it.cap, 0, 500, 0); o.main = it.main ? 1 : 0;
      o.alias = (it.alias instanceof Array ? it.alias : []).map(function (a) { return String(a).trim(); }).filter(Boolean);
      var keys = [key(o.id), key(o.name)].concat(o.alias.map(key)).filter(Boolean);
      o.keys = keys.filter(function (k, i) { return keys.indexOf(k) === i; });
      var m = /^第?0*(\d+)桌?$/.exec(o.name.replace(/\s+/g, ''));
      o.short = (o.main ? '主桌 ' : '') + (m ? m[1] : o.name);
      tables.push(o);
    } else o.label = String(it.label || '').trim();
    items.push(o); maxX = Math.max(maxX, o.x + o.w - 1); maxY = Math.max(maxY, o.y + o.h - 1);
  });
  if (!tables.length) return null;
  tables.forEach(function (t) { t.keys.forEach(function (k) { if (!byKey[k]) byKey[k] = t; }); });
  /* 欄寬／列高：有桌子的欄＝1；只有走道／出入口的欄較窄；只有舞台或空的列較矮 */
  var cols = [], rows = [];
  for (var x = 1; x <= maxX; x++) {
    var hasT = false, hasA = false, hasD = false;
    items.forEach(function (it) { if (x >= it.x && x < it.x + it.w) { if (it.t === 'table' && it.w === 1) hasT = true; else if (it.t === 'aisle') hasA = true; else if (it.t === 'door') hasD = true; } });
    cols.push(hasT ? 1 : hasA ? 0.6 : hasD ? 0.45 : 0.6);
  }
  for (var y = 1; y <= maxY; y++) {
    var any = false;
    items.forEach(function (it) { if (it.t === 'table' && y >= it.y && y < it.y + it.h) any = true; });
    rows.push(any ? 1 : 0.6);
  }
  var cap = 0; tables.forEach(function (t) { cap += t.cap; });
  return {items: items, tables: tables, byKey: byKey, cols: cols, rows: rows, cap: cap};
}
FP.normalize = normalize;
FP.layout = function () {
  var src = (S.ev && S.ev.layout) || CFG.LAYOUT || null;
  if (src === cache.src) return cache.out;
  var out = null; try { out = normalize(src); } catch (e) { out = null; }
  cache.src = src; cache.out = out; return out;
};
FP.raw = function () { return (S.ev && S.ev.layout) || null; };

/* ---------- 統計：每桌的名單人數、已報到、已入座；對不上的桌次另外歸類 ---------- */
function isActive(r) { return !(r.rsvp === '請假' && !r.ci); }
FP.active = isActive;
FP.stats = function (L, all) {
  var st = {tabs: {}, other: {}, none: [], seated: 0, listed: 0, over: 0};
  L.tables.forEach(function (t) { st.tabs[t.id] = {t: t, g: [], n: 0, ci: 0, se: 0, wait: 0, leave: 0, over: false}; });
  all.forEach(function (r) {
    var raw = String(r.tbl || '').trim();
    if (!raw) { st.none.push(r); return; }
    var t = L.byKey[key(raw)];
    if (!t) { (st.other[raw] = st.other[raw] || []).push(r); return; }
    st.tabs[t.id].g.push(r);
  });
  L.tables.forEach(function (t) {
    var x = st.tabs[t.id];
    x.g.forEach(function (r) {
      if (!isActive(r)) { x.leave++; return; }
      x.n++; if (r.ci) x.ci++; if (r.se) x.se++; if (r.ci && !r.se) x.wait++;
    });
    x.over = t.cap > 0 && (x.n > t.cap || x.se > t.cap);
    x.state = (x.ci === 0 && x.se === 0) ? 0 : (x.n > 0 && x.se >= x.n ? 2 : 1);
    st.seated += x.se; st.listed += x.n; if (x.over) st.over++;
  });
  st.otherCount = 0; Object.keys(st.other).forEach(function (k) { st.otherCount += st.other[k].length; });
  return st;
};
/* 某一桌（或「不在圖上」「未排桌」）的貴賓名單。k 可以是版面的桌號、貴賓資料裡的原始桌次文字，或 __other／__none */
FP.guestsOf = function (L, all, k) {
  var st = FP.stats(L, all), seq = function (a, b) { return (a.seq || 99999) - (b.seq || 99999) || String(a.name).localeCompare(String(b.name)); };
  if (k === '__none') return {title: '尚未排桌次', g: st.none.slice().sort(seq), multi: true, st: st};
  if (k === '__other') { var a = []; Object.keys(st.other).forEach(function (q) { a = a.concat(st.other[q]); }); return {title: '桌次不在平面圖上', g: a.sort(seq), multi: true, st: st}; }
  var t = L.byKey[key(k)];
  if (t) { var x = st.tabs[t.id]; return {title: t.name, t: t, x: x, g: x.g.slice().sort(seq), st: st}; }
  var raw = st.other[String(k).trim()] || [];
  return {title: U.tblLabel(k) || String(k), g: raw.slice().sort(seq), st: st, multi: false};
};

/* ---------- 畫平面圖 ---------- */
function cssW(w) { return 'calc(var(--u)*' + w + ')'; }
FP.plan = function (L, st, o) {
  o = o || {}; var attr = o.attr || 'data-ft', n = L.cols.length;
  var h = '<div class="fp"><div class="fp-sum"><span>已入座 <b>' + st.seated + '</b> ／ 名單 <b>' + st.listed + '</b> 位</span><span class="muted">桌位合計 ' + L.cap + (st.over ? ' ・ <span class="fp-bad">⚠ ' + st.over + ' 桌超過桌位</span>' : '') + '</span></div>' +
    '<div class="fp-card"><div class="fp-grid" style="grid-template-columns:' + L.cols.map(cssW).join(' ') + ';grid-template-rows:' + L.rows.map(cssW).join(' ') + '" data-sum="' + L.cols.reduce(function (a, b) { return a + b; }, 0) + '" data-n="' + n + '">';
  L.items.forEach(function (it) {
    var pos = 'grid-column:' + it.x + '/span ' + it.w + ';grid-row:' + it.y + '/span ' + it.h;
    if (it.t === 'stage') h += '<div class="fp-stage" style="' + pos + '">' + esc(it.label || '舞　台') + '</div>';
    else if (it.t === 'aisle') h += '<div class="fp-aisle" style="' + pos + '"><span>' + esc(it.label || '走　道') + '</span></div>';
    else if (it.t === 'door') h += '<div class="fp-door" style="' + pos + '"><span>🚪 ' + esc(it.label || '出入口') + '</span></div>';
    else if (it.t === 'label') h += '<div class="fp-lbl" style="' + pos + '">' + esc(it.label) + '</div>';
    else {
      var x = st.tabs[it.id], cap = it.cap, cls = 'ft g' + x.state + (x.n === 0 ? ' e' : '') + (x.over ? ' ov' : '') + (it.main ? ' main' : '') + (o.sel != null && L.byKey[key(o.sel)] === it ? ' sel' : '') + (it.short.length > 4 && !it.main ? ' long' : '');
      h += '<button type="button" class="' + cls + '" ' + attr + '="' + esc(it.id) + '" style="' + pos + '" aria-label="' + esc(it.name) + '，已入座 ' + x.se + '，桌位 ' + (cap || '未設定') + '，名單 ' + x.n + ' 位' + (x.over ? '，超過桌位' : '') + '，點開看名單">' +
        '<span class="ft-n">' + esc(it.short) + '</span><span class="ft-v">' + x.se + '/' + (cap || '–') + '</span><span class="ft-g">名單 ' + x.n + '</span>' +
        (x.wait ? '<i class="ft-w" title="已報到、待入座">' + x.wait + '</i>' : '') + (x.over ? '<i class="ft-o" title="超過桌位">!</i>' : '') + '</button>';
    }
  });
  h += '</div><div class="fp-legend"><span><i class="g0"></i>尚無人報到</span><span><i class="g1"></i>部分報到／入座</span><span><i class="g2"></i>全部入座</span><span><i class="w">2</i>待入座人數</span><span><i class="o">!</i>名單超過桌位</span><span class="muted">數字＝已入座／桌位</span></div></div>';
  var ex = '';
  if (st.otherCount) ex += '<button type="button" class="fp-note warn" ' + attr + '="__other">⚠ 有 ' + st.otherCount + ' 位貴賓的桌次不在平面圖上（' + esc(Object.keys(st.other).slice(0, 4).join('、')) + (Object.keys(st.other).length > 4 ? '…' : '') + '）　查看 ›</button>';
  if (st.none.length) ex += '<button type="button" class="fp-note" ' + attr + '="__none">尚有 ' + st.none.length + ' 位貴賓還沒排桌次　查看 ›</button>';
  return h + ex + '</div>';
};
/* 依容器寬度決定格子大小（手機縮小、平板放大）。呼叫時機：每次把平面圖放進畫面之後、視窗改變大小時 */
FP.fit = function (scope) {
  var gs = (scope || document).querySelectorAll('.fp-grid');
  for (var i = 0; i < gs.length; i++) {
    var g = gs[i], box = g.parentNode, W = box.clientWidth - 16; if (W <= 0) continue;
    var sum = +g.getAttribute('data-sum') || 7, n = +g.getAttribute('data-n') || 7, gap = W > 560 ? 10 : 6;
    var u = Math.max(26, Math.min(92, Math.floor((W - gap * (n - 1)) / sum * 10) / 10));
    g.style.setProperty('--u', u + 'px'); g.style.setProperty('--g', gap + 'px'); g.classList.toggle('big', u >= 58);
  }
};
window.addEventListener('resize', function () { FP.fit(document); });
window.addEventListener('orientationchange', function () { setTimeout(function () { FP.fit(document); }, 200); });

/* ---------- 本場預設（慶哥的屏東交接典禮）：舞台在上、主桌置中、左三欄／右三欄、中間走道、出入口在右側 ---------- */
FP.preset = function (o) {
  o = o || {}; var mainCap = o.mainCap == null ? 15 : o.mainCap, cap = o.cap == null ? 10 : o.cap, items = [];
  items.push({t: 'stage', label: '舞　台', x: 1, y: 1, w: 7, h: 1});
  items.push({t: 'table', id: '1', name: '第1桌', cap: mainCap, x: 3, y: 2, w: 3, h: 1, main: 1, alias: ['主桌']});
  var L = [[0, 5, 4], [11, 10, 9], [17, 16, 15], [23, 22, 21], [29, 28, 27], [35, 34, 33], [41, 40, 39], [43, 42, 0]];   // 左側：由外到內
  var R = [[3, 2, 0], [8, 7, 6], [14, 13, 12], [20, 19, 18], [26, 25, 24], [32, 31, 30], [38, 37, 36]];                  // 右側：由內到外
  function add(n, x, y) { if (n) items.push({t: 'table', id: String(n), name: '第' + n + '桌', cap: cap, x: x, y: y, w: 1, h: 1}); }
  L.forEach(function (row, i) { row.forEach(function (n, c) { add(n, 1 + c, 3 + i); }); });
  R.forEach(function (row, i) { row.forEach(function (n, c) { add(n, 5 + c, 3 + i); }); });
  add(45, 3, 11); add(44, 5, 11);
  items.push({t: 'aisle', label: '走　道', x: 4, y: 3, w: 1, h: 9});
  items.push({t: 'door', label: '出入口', x: 8, y: 10, w: 1, h: 2});
  return {v: 1, items: items};
};
})();
